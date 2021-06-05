# YOLO Bouldering :boom:

![GitHub](https://img.shields.io/github/license/yarkhinephyo/yolo_bouldering?style=flat-square) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com) ![Website](https://img.shields.io/website?down_color=red&down_message=offline&style=flat-square&up_color=green&up_message=online&url=https%3A%2F%2Fyarkhinephyo.github.io%2FRouteMaker%2F)

In rock climbing/ bouldering, seasoned climbers tend to make routes for one another with unrelated handholds in the gym. One route can be as long as ordered/ unordered 10-30 moves which can include memorization of both handholds and footholds. One way is to draw them out on handphone but it is difficult to point out the exact holds with fat fingers. Labeling the exact order of moves can be troublesome too.

By utilizing Object Detection, this application takes in :camera: pictures of climbing walls and provides the handholds as interactable buttons to make the route creation process easier.

## Ongoing Work

A route sharing system where users can view, grade, vote, comment on each other routes.

## Live Application

Application: https://routemaker.rocks

## Usage

#### 1. Upload the photo of a climbing wall

<img src="https://raw.githubusercontent.com/yarkhinephyo/yolo_bouldering/main/docs/Screenshot_1.jpg" width="200" />

#### 2. The holds will be marked automatically

<img src="https://raw.githubusercontent.com/yarkhinephyo/yolo_bouldering/main/docs/Screenshot_2.jpg" width="200" />

#### 3. Select your handholds

<img src="https://raw.githubusercontent.com/yarkhinephyo/yolo_bouldering/main/docs/Screenshot_3.jpg" width="200" />

#### 4. Select your footholds

<img src="https://raw.githubusercontent.com/yarkhinephyo/yolo_bouldering/main/docs/Screenshot_4.jpg" width="200" />

#### 5. Select number of start holds

<img src="https://raw.githubusercontent.com/yarkhinephyo/yolo_bouldering/main/docs/Screenshot_5.jpg" width="200" />

#### 6. Export as an image to share with friends

<img src="https://raw.githubusercontent.com/yarkhinephyo/yolo_bouldering/main/docs/Screenshot_6.jpg" width="200" />

## Local Setup

```bash
# Ensure npm is installed
# Ensure AWS credentials are set up for Serverless backend
# Ensure Docker engine is running for preparing pip packages
cd ./lambda_backend
npm ci
cd ./predict_microservice
sls deploy

cd ./ionic_user_interface
echo "VUE_APP_PREDICT_ENDPOINT_URL={serverless_url_here}" > .env
npm ci
npm run serve
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
