import cv2
import numpy as np
import glob
import random
import argparse

from os.path import join
import os

def normalise(x, y, w, h, W, H):
  x += w/2
  x /= W
  y += h/2
  y /= H
  w /= W
  h /= H
  return x, y, w, h
  
DEF_WEIGHTS = join(os.pardir, os.pardir, "lambda_backend", "predict_microservice", "weights", "yolov4-tiny-obj.weights")
DEF_CONFIG = join(os.pardir, os.pardir, "lambda_backend", "predict_microservice", "weights", "yolov4-tiny-obj.cfg")

# Parsing arguments
parser = argparse.ArgumentParser()
parser.add_argument("-w", "--weights", help="learned weights from model", default=DEF_WEIGHTS)
parser.add_argument("-c", "--config", help="config of yolo", default=DEF_CONFIG)
args = parser.parse_args()

# Load Yolo
net = cv2.dnn.readNet(
    # join(os.pardir, os.pardir, "lambda_backend", "predict_microservice", "weights", "yolov4-tiny-obj_2000.weights"), 
    # join(os.pardir, os.pardir, "lambda_backend", "predict_microservice", "weights", "yolov4-tiny-obj.cfg")    
    # join(os.curdir, "yolov4-tiny-obj_4000.weights"), 
    # join(os.curdir, "yolov4-tiny-obj.cfg")
    args.weights,
    args.config
)

# Name custom object
classes = ["hold", "volume"]

# Images path
images_path = glob.glob(join(os.curdir, "test_images", "*.jpg"))

layer_names = net.getLayerNames()
output_layers = [layer_names[i[0] - 1] for i in net.getUnconnectedOutLayers()]
colors = np.random.uniform(0, 255, size=(len(classes), 3))

# Insert here the path of your images
random.shuffle(images_path)
# loop through all the images
for img_path in images_path:
    # Loading image
    img = cv2.imread(img_path)
    # img = cv2.resize(img, None, fx=0.6, fy=0.6)
    height, width, channels = img.shape
    # Get filename for labelfile
    labelfile = os.path.splitext(img_path)[0]

    # Detecting objects
    blob = cv2.dnn.blobFromImage(img, 0.00392, (416, 416), (0, 0, 0), True, crop=False)

    net.setInput(blob)
    outs = net.forward(output_layers)

    # Showing informations on the screen
    class_ids = []
    confidences = []
    boxes = []

    for out in outs:
        # print(out)
        for detection in out:
            # print(detection)
            
            scores = detection[5:]
            class_id = np.argmax(scores)
            confidence = scores[class_id]
            if confidence > 0.3:
                # Object detected
                # print(class_id)
                center_x = int(detection[0] * width)
                center_y = int(detection[1] * height)
                w = int(detection[2] * width)
                h = int(detection[3] * height)

                # Rectangle coordinates
                x = int(center_x - w / 2)
                y = int(center_y - h / 2)

                boxes.append([x, y, w, h])
                confidences.append(float(confidence))
                class_ids.append(class_id)

    indexes = cv2.dnn.NMSBoxes(boxes, confidences, 0.5, 0.4)
    # print(indexes)
    font = cv2.FONT_HERSHEY_PLAIN
    f = open(labelfile + ".txt", "w+")
    for i in indexes:
        i = int(i)
        x, y, w, h = boxes[i]
        label = str(classes[class_ids[i]])
        color = colors[class_ids[i]]
        cv2.rectangle(img, (x, y), (x + w, y + h), color, 2)
        cv2.putText(img, label, (x, y + 30), font, 1, color, 2)
        
        # Normalise for yolo labeling format
        x, y, w, h = normalise(x, y, w, h, width, height)
        f.write(f'0 {x} {y} {w} {h}\n')
    f.close()

    cv2.imshow("Image", img)
    key = cv2.waitKey(0)

cv2.destroyAllWindows()
