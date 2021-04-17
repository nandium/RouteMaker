# YOLO Bouldering :boom:

In rock climbing/ bouldering, seasoned climbers tend to make routes for one another with unrelated handholds in the gym. One route can be as long as ordered/ unordered 10-30 moves which can include memorization of both handholds and footholds. One way is to draw them out on handphone but it is difficult to point out the exact holds with fat fingers. Labeling the exact order of moves can be troublesome too.

By utilizing Object Detection, this application takes in :camera: pictures of climbing walls and provides the handholds as interactable buttons to make the route creation process easier. 

## Live Application

Application: https://yarkhinephyo.github.io/RouteMaker/

The Object Detection model is trained on yolov4-tiny. Hence it is sufficiently small for Serverless deployment on AWS Lambda. The user interface is built with Vue and is deployed on Github pages.

## Usage
#### 1. Take photo of a climbing wall

![Alt desc](https://raw.githubusercontent.com/yarkhinephyo/yolo_bouldering/main/docs/Screenshot_1.jpg)

#### 2. Select handholds and footholds
![Alt desc](https://raw.githubusercontent.com/yarkhinephyo/yolo_bouldering/main/docs/Screenshot_2.jpg)

#### 3. Export as a picture to share with friends
![Alt desc](https://raw.githubusercontent.com/yarkhinephyo/yolo_bouldering/main/docs/Screenshot_3.jpg)
## Deployment

```bash
# Ensure AWS credentials are set up for Serverless backend
# Ensure Serverless framework is installed (2.11.1)
# Ensure Docker engine is running for preparing pip packages
cd ./lambda_backend
npm i
sls deploy

# Ensure npm is installed
cd ./user_interface
echo "VUE_APP_GET_BOUNDING_BOX_URL={serverless_url_here}" > .env
npm i
npm run serve
```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.