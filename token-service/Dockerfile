FROM node:0.12.1

MAINTAINER Zalando SE

RUN npm install basic-auth@1.0.1
RUN npm install express@4.12.4

COPY /src/ /www/

WORKDIR /www/
CMD node server.js
EXPOSE 3002