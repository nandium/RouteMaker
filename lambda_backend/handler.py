from requests_toolbelt.multipart import decoder
from PIL import Image
import numpy as np
import cv2

from os.path import join
import os
import glob
import json
import base64
import io

# Load Yolo
net = cv2.dnn.readNet(
    join("weights", "yolov4-tiny-obj_2000.weights"),
    join("weights", "yolov4-tiny-obj.cfg")
)

# Names of custom objects
classes = ["hold", "volume"]

layer_names = net.getLayerNames()
output_layers = [layer_names[i[0] - 1] for i in net.getUnconnectedOutLayers()]

def predict(event, context):
    """Given an image with multipart/form-data, 
    YOLO model is ran to return bounding boxes of climbing holds.

    Args:
        event (dict): API Gateway Format,
        context (dict): API Gateway Format

    Returns:
        API Gateway Response (dict): {
            "statusCode": <>, 
            "body": <>, 
            "headers": <>
        }

    """
    img = retrieve_numpy_image(event)

    height, width, channels = img.shape

    # Image Blob
    blob = cv2.dnn.blobFromImage( 
        img, 
        0.00392, 
        (416, 416), 
        (0, 0, 0), 
        True, 
        crop=False
    )

    net.setInput(blob)
    outs = net.forward(output_layers)

    boxes = []

    for out in outs:
        for detection in out:
            scores = detection[5:]
            class_id = np.argmax(scores)
            confidence = scores[class_id]
            if confidence > 0.3:
                # Object detected
                center_x = int(detection[0] * width)
                center_y = int(detection[1] * height)
                w = int(detection[2] * width)
                h = int(detection[3] * height)

                # Rectangle coordinates
                x = int(center_x - w / 2)
                y = int(center_y - h / 2)

                boxes.append({
                    "x": x,
                    "y": y,
                    "w": w,
                    "h": h,
                    "confidence": float(confidence),
                    "class": classes[class_id]
                })

    return {
        "statusCode": "200", 
        "body": json.dumps({ 
            'boxes': boxes
        }), 
        "headers": { 'Access-Control-Allow-Origin': "*" }
    }

def retrieve_numpy_image(event):
    """Given an API Gateway event, returns the image attached in a numpy format

    Args:
        event (dict): API Gateway Format

    Returns:
        Decoded Image: Numpy array of shape (height, width, channels)
    """
    content_type = event["headers"]["Content-Type"]
    body_dec = base64.b64decode(event["body"])

    multipart_data = decoder.MultipartDecoder(body_dec, content_type)
    binary_content = []
    for part in multipart_data.parts:
        binary_content.append(part.content)
    imageStream = io.BytesIO(binary_content[0])
    imageFile = Image.open(imageStream)
    
    return np.array(imageFile) 