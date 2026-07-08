#!/bin/bash
set -e

exec > /var/log/assemblemonitor-userdata.log 2>&1

echo "===== AssembleMonitor user-data started ====="

apt-get update -y

apt-get install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  unzip \
  jq \
  awscli

# Install Docker
install -m 0755 -d /etc/apt/keyrings

curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -y

apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker

usermod -aG docker ubuntu

# App directory
cd /home/ubuntu

if [ ! -d "AssembleMonitor-DevOps" ]; then
  git clone "${github_repo_url}"
fi

cd /home/ubuntu/AssembleMonitor-DevOps

# Fetch secret from Secrets Manager
SECRET_JSON=$(aws secretsmanager get-secret-value \
  --region "${aws_region}" \
  --secret-id "${secret_name}" \
  --query SecretString \
  --output text)

mkdir -p backend

DATABASE_URL=$(echo "$SECRET_JSON" | jq -r '.DATABASE_URL')
JWT_SECRET_KEY=$(echo "$SECRET_JSON" | jq -r '.JWT_SECRET_KEY')
AWS_REGION=$(echo "$SECRET_JSON" | jq -r '.AWS_REGION')
S3_BUCKET_NAME=$(echo "$SECRET_JSON" | jq -r '.S3_BUCKET_NAME')

cat > backend/.env <<EOF
DATABASE_URL=$DATABASE_URL
JWT_SECRET_KEY=$JWT_SECRET_KEY
AWS_REGION=$AWS_REGION
S3_BUCKET_NAME=$S3_BUCKET_NAME
EOF

chmod 600 backend/.env
chown -R ubuntu:ubuntu /home/ubuntu/AssembleMonitor-DevOps

# Create production-style compose file if missing
cat > docker-compose.alb.yml <<EOF
services:
  api:
    image: ${backend_image}:latest
    container_name: assemblemonitor_api
    restart: unless-stopped
    env_file:
      - ./backend/.env
    environment:
      PYTHONPATH: /app
    ports:
      - "127.0.0.1:8000:8000"

  frontend:
    image: ${frontend_image}:latest
    container_name: assemblemonitor_frontend
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:80"
    depends_on:
      - api
EOF

# Install Nginx on host
apt-get install -y nginx

cat > /etc/nginx/sites-available/assemblemonitor <<'EOF'
server {
    listen 80;
    server_name _;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
        proxy_set_header Host $host;
    }

    location /openapi.json {
        proxy_pass http://127.0.0.1:8000/openapi.json;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

ln -sf /etc/nginx/sites-available/assemblemonitor /etc/nginx/sites-enabled/assemblemonitor
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl restart nginx

# Pull and start containers
docker compose -f docker-compose.alb.yml pull
docker compose -f docker-compose.alb.yml up -d

echo "Waiting for backend health..."

for i in {1..30}; do
  if curl -fsS http://127.0.0.1:8000/api/health; then
    echo "Backend is healthy"
    break
  fi

  echo "Backend not ready yet... attempt $i"
  sleep 10
done

echo "Running Alembic migrations..."
docker compose -f docker-compose.alb.yml exec -T api sh -c "cd /app && alembic upgrade head"

echo "Final container status:"
docker ps

echo "Final Nginx health check:"
curl -fsS http://127.0.0.1/api/health

echo "===== AssembleMonitor user-data completed ====="