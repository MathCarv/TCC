# Use uma imagem base Node.js
FROM node:14

# Defina a pasta de trabalho dentro do container
WORKDIR /usr/src/app

# Copie o package.json e o package-lock.json
COPY package*.json ./

# Instale as dependências
RUN npm install

# Instale o nodemon para o hot reloading
RUN npm install -g nodemon

# Copie o restante dos arquivos da aplicação
COPY . .

# Exponha a porta que a aplicação usa
EXPOSE 8080

# Comando para iniciar a aplicação com nodemon para o hot reloading
CMD [ "nodemon", "start" ]
