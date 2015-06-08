FROM node:0.12.1

MAINTAINER Zalando SE

RUN npm install express@4.12.4
RUN npm install superagent@1.2.0

COPY /src/ /www/

WORKDIR /www/
CMD node server.js
EXPOSE 3002