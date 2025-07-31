Inicio del repositorio

# Autogenerate migration cmd:
docker-compose exec api alembic revision --autogenerate -m "Initial migration"

# Apply migrations cmd:
docker-compose exec api alembic upgrade head