#!/bin/bash
cd /var/www/pet-grooming-saas
git pull
npm install
npm run build
pm2 restart pet-grooming --update-env
echo "部署完成！"
