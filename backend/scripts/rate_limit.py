import time
import requests
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Optional, Any
import threading

class RateLimitStressTester:
    """Herramienta avanzada para probar límites de tasa en APIs con análisis detallado"""
    
    def __init__(self, base_url: str = "http://localhost:8000", endpoint: str = "/"):
        self.url = f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        self.results: List[Dict[str, Any]] = []
        self.lock = threading.Lock()
        self.reset_timestamps: List[float] = []
        self.error_buffer = 0.5  # Margen de error en segundos
        
    def _make_request(self) -> Optional[requests.Response]:
        """Realiza una solicitud individual con registro detallado"""
        try:
            start = time.perf_counter()
            response = requests.get(self.url)
            elapsed = (time.perf_counter() - start) * 1000
            
            # Registrar metadatos de la solicitud
            result = {
                'timestamp': datetime.now(timezone.utc),
                'status': response.status_code,
                'latency_ms': elapsed,
                'success': response.status_code == 200,
                'headers': dict(response.headers),
                'limited': response.status_code == 429
            }
            
            with self.lock:
                self.results.append(result)
                
            return response
        except Exception as e:
            print(f"⚠️ Error en solicitud: {str(e)}")
            return None

    def _print_request_details(self, response: requests.Response, elapsed_ms: float):
        """Muestra detalles de la solicitud con formato legible"""
        timestamp = datetime.now(timezone.utc).strftime("[%H:%M:%S.%f")[:-3] + "]"
        
        print(f"\n{timestamp} Solicitud → {self.url}")
        print(f"Estado: {response.status_code} | Latencia: {elapsed_ms:.2f}ms")
        
        # Analizar encabezados de límite de tasa
        headers = response.headers
        limit_headers = {
            'x-ratelimit-limit': headers.get('x-ratelimit-limit', 'N/A'),
            'x-ratelimit-remaining': headers.get('x-ratelimit-remaining', 'N/A'),
            'x-ratelimit-reset': headers.get('x-ratelimit-reset', 'N/A'),
            'retry-after': headers.get('retry-after', 'N/A')
        }
        
        # Convertir timestamp de reset a formato legible
        reset_info = ""
        if limit_headers['x-ratelimit-reset'] != 'N/A':
            try:
                reset_time = float(limit_headers['x-ratelimit-reset'])
                reset_info = f" ({datetime.fromtimestamp(reset_time, tz=timezone.utc).strftime('%H:%M:%S')} UTC)"
                self.reset_timestamps.append(reset_time)
            except ValueError:
                pass
        
        # Mostrar encabezados relevantes
        if any(v != 'N/A' for v in limit_headers.values()):
            print("Encabezados de Límite:")
            for k, v in limit_headers.items():
                if v != 'N/A':
                    print(f"  {k}: {v}{reset_info if k == 'x-ratelimit-reset' else ''}")

    def _calculate_stats(self) -> Dict[str, Any]:
        """Calcula estadísticas de las solicitudes realizadas"""
        success_count = 0
        blocked_count = 0
        other_codes: Dict[int, int] = {}
        
        for r in self.results:
            if r['success']:
                success_count += 1
            elif r['limited']:
                blocked_count += 1
            else:
                code = int(r['status'])
                other_codes[code] = other_codes.get(code, 0) + 1 # type: ignore
                
        return {
            'total': len(self.results),
            'success': success_count,
            'blocked': blocked_count,
            'other_codes': other_codes
        }

    def _find_rate_limit_threshold(self) -> Tuple[int, int]:
        """Determina cuándo comenzó el bloqueo por límite de tasa"""
        first_blocked = -1
        consecutive_blocks = 0
        
        for i, result in enumerate(self.results):
            if result['limited']:
                consecutive_blocks += 1
                if first_blocked == -1:
                    first_blocked = i
            else:
                consecutive_blocks = 0
                
            # Detener si encontramos 5 bloqueos consecutivos
            if consecutive_blocks >= 5:
                return first_blocked, i
        
        return first_blocked, len(self.results) - 1

    def _wait_for_reset(self):
        """Espera el período de reset con margen de error"""
        if not self.reset_timestamps:
            print("⚠️ No se detectaron encabezados de reset")
            return

        # Usar el timestamp de reset más reciente
        reset_time = max(self.reset_timestamps) + self.error_buffer
        current_time = time.time()
        
        if reset_time <= current_time:
            print("✅ El período de reset ya ha expirado")
            return
            
        wait_duration = reset_time - current_time
        reset_utc = datetime.fromtimestamp(reset_time, tz=timezone.utc).strftime('%H:%M:%S')
        
        print(f"\n⏳ Esperando reset hasta {reset_utc} UTC ({wait_duration:.2f}s)...")
        time.sleep(wait_duration)

    def _verify_reset(self):
        """Verifica si el límite de tasa se ha restablecido"""
        print("\nVerificando reset después de la espera...")
        response = self._make_request()
        
        if response and response.status_code == 200:
            print("✅ Reset exitoso - Solicitudes permitidas nuevamente")
            return True
        else:
            print("❌ Falla en el reset - Todavía bloqueado")
            return False

    def run_test(self, total_requests: int = 100, request_delay: float = 0.1):
        """
        Ejecuta la prueba de estrés contra el endpoint
        
        Args:
            total_requests: Número total de solicitudes a realizar
            request_delay: Retardo entre solicitudes en segundos
        """
        print(f"\n{'#' * 60}")
        print(f"🚀 Iniciando prueba de estrés: {total_requests} solicitudes")
        print(f"🔗 Endpoint: {self.url}")
        print(f"⏱  Delay entre solicitudes: {request_delay}s")
        print(f"🛡  Margen de error: {self.error_buffer}s")
        print(f"{'#' * 60}\n")
        
        # Fase 1: Ejecutar solicitudes secuenciales
        for i in range(total_requests):
            response = self._make_request()
            if response:
                self._print_request_details(response, self.results[-1]['latency_ms'])
            
            # Detener si tenemos 5 bloqueos consecutivos
            if len(self.results) >= 5 and all(r['limited'] for r in self.results[-5:]):
                print("\n🛑 Detenido por 5 bloqueos consecutivos")
                break
                
            time.sleep(request_delay)
        
        # Calcular estadísticas
        stats = self._calculate_stats()
        
        # Mostrar resumen
        print(f"\n{'=' * 60}")
        print("📊 RESUMEN DE PRUEBA")
        print(f"Total solicitudes: {stats['total']}")
        print(f"Exitosa (200): {stats['success']}")
        print(f"Bloqueada (429): {stats['blocked']}")
        for code, count in stats['other_codes'].items():
            print(f"Otro estado ({code}): {count}")
        
        # Determinar umbral de límite
        first_block, last_block = self._find_rate_limit_threshold()
        if first_block >= 0:
            print(f"\n🔒 Bloqueo iniciado en solicitud #{first_block + 1}")
            print(f"🚧 Último bloqueo en solicitud #{last_block + 1}")
            print(f"💡 Solicitudes exitosas antes del bloqueo: {first_block}")
        
        # Fase 2: Manejo de reset
        if stats['blocked'] > 0:
            print(f"\n{'=' * 60}")
            print("⏳ Iniciando verificación de reset...")
            self._wait_for_reset()
            reset_ok = self._verify_reset()
            
            if reset_ok:
                print("✅ Sistema de límite de tasa funciona correctamente")
            else:
                print("❌ Problemas detectados en el reset del límite de tasa")
        else:
            print("\n⚠️ No se detectaron bloqueos - Verificar configuración")

if __name__ == "__main__":
    # Configuración personalizable
    tester = RateLimitStressTester(
        base_url="http://localhost:8000",
        endpoint="/"
    )
    
    tester.run_test(
        total_requests=50,      # Número de solicitudes a intentar
        request_delay=0.1       # Segundos entre solicitudes
    )