#!/bin/sh

# Author : Yar Khine Phyo

npm i
cd ./cognito_setup
sls deploy --stage $1
cd ../user_microservice
sls deploy --stage $1
echo "success"