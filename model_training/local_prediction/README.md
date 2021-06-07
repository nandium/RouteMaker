# Improving Model using LabelImg

## Prerequisites

Tested on

- Windows 10 (not WSL, since `cv2.imshow` is being used to visualise predictions)
- Python 3.7
- [LabelImg](https://github.com/tzutalin/labelImg/releases)

## Getting Started

1. Create and enter `virtualenv` if not done so already.
   ```bash
   $ virtualenv venv
   $ .\venv\Scripts\activate
   ```
1. Install `opencv`.
   ```bash
   $ pip install opencv-python
   ```
1. Running the Python script now will give predictions on images in `.\test_images\` based on weights and config given by the repo, located at [`..\..\lambda_backend\predict_microservice\weights`](https://github.com/yarkhinephyo/yolo_bouldering/tree/main/lambda_backend/predict_microservice/weights). Images will appear with the predicted bounding boxes.
   ```bash
   $ python yolo_object_detection.py
   ```
1. To obtain predictions on new images, simply place them in `.\test_images\` and run the script.
1. Run LabelImg and open the `.\test_images\` directory. You can now adjust the bounding boxes and subsequently save the corresponding `.txt` files. The images can then be used as training data for the model.
1. Some images may face an issue where a `ZeroDivisionError` occurs when saving using LabelImg. Be sure to check for this by saving after a single edit to avoid losing all your work.
   ```bash
   ...
   ZeroDivisionError: float division by zero
   ```
   If this occurs, change the image format from:
   - `.png` to `.jpg`, if it is originally `.png`
   - `.jpg` to `.png`, if it is originally `.jpg`

## Training with Google Colab

1. Zip up all training data - images and labels - into a zipfile `images.zip`.
1. Create a folder `/yolov4_tiny` in your Google drive, and save `images.zip` inside it.
1. Open up `../Train_yolov4_tiny.ipynb` in Google Colab, then click Runtime > Run All (Ctrl+F9).
1. The model will be trained with the hyperparameters as set in the document. You can update them as you see fit, following guidance from the [darknet documentation](https://github.com/AlexeyAB/darknet#when-should-i-stop-training).
1. The key performance indicator will be the mAP (higher better).
   ```bash
   mean average precision (mAP@0.50) = 0.823387, or 82.34 %
   ```
