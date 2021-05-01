#!/bin/sh

# Author : Yar Khine Phyo

# Usage : sudo node-serverless.sh [deploy|remove] [dev|prod]

npm i
if [ $1 == "deploy" ]
then
  cd ./cognito_setup
  sls deploy --stage $2
  cd ../route_database_setup
  sls deploy --stage $2
  cd ../s3_bucket_setup
  sls deploy --stage $2
  cd ../user_microservice
  sls deploy --stage $2
  cd ../route_microservice
  sls deploy --stage $2
elif [ $1 == "remove" ]
then
  cd ./route_microservice
  sls remove --stage $2
  cd ../user_microservice
  sls remove --stage $2
  cd ../s3_bucket_setup
  sls remove --stage $2
  cd ../route_database_setup
  sls remove --stage $2
  cd ../cognito_setup
  sls remove --stage $2
fi
echo "success"