#!/bin/bash

# ============================================
# Configuration — UPDATE THESE
# ============================================
WEB01_IP="44.204.187.151"
WEB02_IP="18.208.156.75"
SSH_USER="ubuntu"
REMOTE_DIR="/home/ubuntu/job-dashboard"

# ============================================
# First-time setup (run once per server)
# ============================================
setup_server() {
  local IP=$1
  echo "🔧 Setting up server $IP..."
  ssh -T ${SSH_USER}@${IP} << ENDSSH
    echo "Installing Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - 2>/dev/null
    sudo apt-get install -y nodejs 2>/dev/null
    
    echo "Installing PM2..."
    sudo npm install -g pm2 2>/dev/null
    
    echo "Creating project directory..."
    mkdir -p ${REMOTE_DIR}
    
    node --version
    npm --version
    pm2 --version
ENDSSH
  echo "✅ Server $IP setup complete"
}

# ============================================
# Deploy to a single server
# ============================================
deploy_to() {
  local IP=$1
  echo ""
  echo "🚀 Deploying to ${IP}..."
  
  # Copy files
  scp server.js ${SSH_USER}@${IP}:${REMOTE_DIR}/
  scp package.json ${SSH_USER}@${IP}:${REMOTE_DIR}/
  scp -r public ${SSH_USER}@${IP}:${REMOTE_DIR}/
  
  # Copy .env (careful — this has your API key!)
  scp .env ${SSH_USER}@${IP}:${REMOTE_DIR}/
  
  # Install & restart on server
  ssh ${SSH_USER}@${IP} << ENDSSH
    cd ${REMOTE_DIR}
    npm install --production
    
    pm2 delete job-dashboard 2>/dev/null || true
    pm2 start server.js --name job-dashboard
    pm2 save
    
    echo "Running processes:"
    pm2 list
ENDSSH

  echo "✅ ${IP} deployed"
}

# ============================================
# Main
# ============================================
echo "📦 Job Market Explorer — Deployment"
echo "===================================="
echo ""

# First time? Uncomment these lines:
# setup_server $WEB01_IP
# setup_server $WEB02_IP

deploy_to $WEB01_IP
deploy_to $WEB02_IP

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Test URLs:"
echo "  Web01: http://${WEB01_IP}:3000"
echo "  Web02: http://${WEB02_IP}:3000"
echo "  Health: http://${WEB01_IP}:3000/health"
