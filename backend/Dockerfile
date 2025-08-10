# Use Node.js 18 LTS
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci  # install dev dependencies too

COPY . .

RUN npm run build  # build while typescript is still installed

RUN npm ci --omit=dev  # now remove dev dependencies

EXPOSE 3000

CMD ["npm", "start"]
