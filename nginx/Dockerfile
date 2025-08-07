FROM nginx:latest

# Crear directorio para certificados
RUN mkdir -p /etc/nginx/certs

# Generar certificado SSL autofirmado
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/certs/selfsigned.key \
    -out /etc/nginx/certs/selfsigned.crt \
    -subj "/CN=localhost"

# Crear configuración de Nginx
RUN echo "events {}" > /etc/nginx/nginx.conf
RUN echo "http {" >> /etc/nginx/nginx.conf
RUN echo "  # Allow non-standard headers and underscores" >> /etc/nginx/nginx.conf
RUN echo "  ignore_invalid_headers off;" >> /etc/nginx/nginx.conf
RUN echo "  underscores_in_headers on;" >> /etc/nginx/nginx.conf
RUN echo "  # Increase buffer sizes to handle large headers" >> /etc/nginx/nginx.conf
RUN echo "  proxy_buffer_size 16k;" >> /etc/nginx/nginx.conf
RUN echo "  proxy_buffers 4 16k;" >> /etc/nginx/nginx.conf
RUN echo "  proxy_busy_buffers_size 32k;" >> /etc/nginx/nginx.conf
RUN echo "  server {" >> /etc/nginx/nginx.conf
RUN echo "    listen 80;" >> /etc/nginx/nginx.conf
RUN echo "    server_name localhost;" >> /etc/nginx/nginx.conf
RUN echo "    return 301 https://\$host\$request_uri;" >> /etc/nginx/nginx.conf
RUN echo "  }" >> /etc/nginx/nginx.conf
RUN echo "  server {" >> /etc/nginx/nginx.conf
RUN echo "    listen 443 ssl;" >> /etc/nginx/nginx.conf
RUN echo "    server_name localhost;" >> /etc/nginx/nginx.conf
RUN echo "    ssl_certificate /etc/nginx/certs/selfsigned.crt;" >> /etc/nginx/nginx.conf
RUN echo "    ssl_certificate_key /etc/nginx/certs/selfsigned.key;" >> /etc/nginx/nginx.conf
RUN echo "    # Ensure all request headers are passed" >> /etc/nginx/nginx.conf
RUN echo "    proxy_pass_request_headers on;" >> /etc/nginx/nginx.conf
RUN echo "    location /api/ {" >> /etc/nginx/nginx.conf
RUN echo "      proxy_pass http://api:8000/;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_set_header Host \$host;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_set_header X-Real-IP \$remote_addr;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_set_header X-Forwarded-Proto \$scheme;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_set_header Authorization \$http_authorization;" >> /etc/nginx/nginx.conf
RUN echo "      # Preserve backend response headers" >> /etc/nginx/nginx.conf
RUN echo "      proxy_pass_header Server;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_pass_header Content-Type;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_pass_header X-CSRF-Token;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_pass_header Authorization;" >> /etc/nginx/nginx.conf
RUN echo "      # Add CORS headers for API" >> /etc/nginx/nginx.conf
RUN echo "      add_header Access-Control-Allow-Origin '*' always;" >> /etc/nginx/nginx.conf
RUN echo "      add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS' always;" >> /etc/nginx/nginx.conf
RUN echo "      add_header Access-Control-Allow-Headers 'Authorization, Content-Type, X-CSRF-Token' always;" >> /etc/nginx/nginx.conf
RUN echo "      add_header Access-Control-Expose-Headers 'X-CSRF-Token, Content-Type, Authorization, Server, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset' always;" >> /etc/nginx/nginx.conf
RUN echo "      add_header X-Proxy-Status 'Proxied' always;" >> /etc/nginx/nginx.conf
RUN echo "      # Handle CORS preflight requests" >> /etc/nginx/nginx.conf
RUN echo "      if (\$request_method = 'OPTIONS') {" >> /etc/nginx/nginx.conf
RUN echo "        add_header Access-Control-Allow-Origin '*' always;" >> /etc/nginx/nginx.conf
RUN echo "        add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS' always;" >> /etc/nginx/nginx.conf
RUN echo "        add_header Access-Control-Allow-Headers 'Authorization, Content-Type, X-CSRF-Token' always;" >> /etc/nginx/nginx.conf
RUN echo "        add_header Access-Control-Max-Age 1728000;" >> /etc/nginx/nginx.conf
RUN echo "        add_header Content-Type 'text/plain charset=UTF-8';" >> /etc/nginx/nginx.conf
RUN echo "        add_header Content-Length 0;" >> /etc/nginx/nginx.conf
RUN echo "        return 204;" >> /etc/nginx/nginx.conf
RUN echo "      }" >> /etc/nginx/nginx.conf
RUN echo "    }" >> /etc/nginx/nginx.conf
RUN echo "    location / {" >> /etc/nginx/nginx.conf
RUN echo "      proxy_pass http://frontend:5173/;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_http_version 1.1;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_set_header Host \$host;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_set_header X-Real-IP \$remote_addr;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_set_header X-Forwarded-Proto \$scheme;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_set_header Upgrade \$http_upgrade;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_set_header Connection \"upgrade\";" >> /etc/nginx/nginx.conf
RUN echo "      proxy_pass_request_headers on;" >> /etc/nginx/nginx.conf
RUN echo "      # Preserve frontend response headers" >> /etc/nginx/nginx.conf
RUN echo "      proxy_pass_header Server;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_pass_header Content-Type;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_pass_header X-CSRF-Token;" >> /etc/nginx/nginx.conf
RUN echo "      # Add CORS headers for frontend" >> /etc/nginx/nginx.conf
RUN echo "      add_header Access-Control-Allow-Origin '*' always;" >> /etc/nginx/nginx.conf
RUN echo "      add_header Access-Control-Expose-Headers 'X-CSRF-Token, Content-Type, Authorization, Server, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset' always;" >> /etc/nginx/nginx.conf
RUN echo "      add_header X-Proxy-Status 'Proxied' always;" >> /etc/nginx/nginx.conf
RUN echo "    }" >> /etc/nginx/nginx.conf
RUN echo "    location /grafana/ {" >> /etc/nginx/nginx.conf
RUN echo "      proxy_pass http://grafana:3000/;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_set_header Host \$host;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_set_header X-Real-IP \$remote_addr;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_set_header X-Forwarded-Proto \$scheme;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_pass_request_headers on;" >> /etc/nginx/nginx.conf
RUN echo "      # Preserve Grafana response headers" >> /etc/nginx/nginx.conf
RUN echo "      proxy_pass_header Server;" >> /etc/nginx/nginx.conf
RUN echo "      proxy_pass_header Content-Type;" >> /etc/nginx/nginx.conf
RUN echo "      # Add CORS headers for Grafana" >> /etc/nginx/nginx.conf
RUN echo "      add_header Access-Control-Allow-Origin '*' always;" >> /etc/nginx/nginx.conf
RUN echo "      add_header Access-Control-Expose-Headers 'X-CSRF-Token, Content-Type, Authorization, Server, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset' always;" >> /etc/nginx/nginx.conf
RUN echo "      add_header X-Proxy-Status 'Proxied' always;" >> /etc/nginx/nginx.conf
RUN echo "    }" >> /etc/nginx/nginx.conf
RUN echo "  }" >> /etc/nginx/nginx.conf
RUN echo "}" >> /etc/nginx/nginx.conf

# Exponer puertos HTTP y HTTPS
EXPOSE 80
EXPOSE 443