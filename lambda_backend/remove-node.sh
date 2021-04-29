#!/bin/sh

# Author : Yar Khine Phyo

npm i
cd ./user_microservice
sls remove --stage $1
cd ../cognito_setup
sls remove --stage $1
echo "success"