#!/bin/sh

# Author : Yar Khine Phyo

# Usage : sudo node-serverless.sh [deploy|remove] [dev|prod] [node|all]
# Ensure S3 bucket is empty before removal

npm i
rm -f .env
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
  sls info --verbose | grep ServiceEndpoint | sed s/ServiceEndpoint\:\ //g | { read -r var; cd ..; echo "USER_ENDPOINT_URL=$var" >> .env; }
  cd ../route_microservice
  sls deploy --stage $2
  sls info --verbose | grep ServiceEndpoint | sed s/ServiceEndpoint\:\ //g | { read -r var; cd ..; echo "ROUTE_ENDPOINT_URL=$var" >> .env; }
  if [ ${3:-node} == "all" ]
  then
    cd ../predict_microservice
    sls deploy --stage $2
    sls info --verbose | grep ServiceEndpoint | sed s/ServiceEndpoint\:\ //g | { read -r var; cd ..; echo "PREDICT_ENDPOINT_URL=$var" >> .env; }
  fi
  cd ..
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
  if [ ${3:-node} == "all" ]
  then
    cd ../predict_microservice
    sls remove --stage $2
  fi
  cd ..
fi
echo "success"