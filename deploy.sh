#!/bin/bash
cd /var/www/pet-grooming-saas
git pull
npm install
npx prisma generate
npm run build
pm2 restart pet-grooming --update-env
echo "部署完成！"
