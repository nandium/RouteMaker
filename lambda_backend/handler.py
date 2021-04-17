import numpy as np
import cv2

from os.path import join
import os
import glob
import json
import base64

from utils import exception_handler, retrieve_numpy_image, parse_multipart_data

ALLOWED_TYPES = ["image/jpeg"]

# Load Yolo
net = cv2.dnn.readNet(
    join("weights", "yolov4-tiny-obj_2000.weights"),
    join("weights", "yolov4-tiny-obj.cfg")
)

# Names of custom objects
classes = ["hold", "volume"]

layer_names = net.getLayerNames()
output_layers = [layer_names[i[0] - 1] for i in net.getUnconnectedOutLayers()]


@exception_handler
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
    headers = event["headers"]

    # Bug where headers sent from Postman and Axios are different
    content_type = headers["Content-Type"] if "Content-Type" in headers else headers["content-type"]
    body_dec = base64.b64decode(event["body"])
    multipart_items = parse_multipart_data(body_dec, content_type)

    image_dict = list(filter(lambda x: x["params"]
                             ["name"] == "image", multipart_items))[0]
    width_dict = list(filter(lambda x: x["params"]
                             ["name"] == "width", multipart_items))[0]

    assert image_dict["type"] in ALLOWED_TYPES, "Unallowed file type"

    img = retrieve_numpy_image(image_dict["content"])
    height, width, channels = img.shape

    scaled_width = int(width_dict["content"].decode("utf-8"))

    # If given width is 0, do not scale
    scaled_width = scaled_width if scaled_width != 0 else width
    scaled_height = int((scaled_width / width) * height)

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

    box_dimensions = []
    box_confidences = []
    class_ids = []

    for out in outs:
        for detection in out:
            scores = detection[5:]
            class_id = np.argmax(scores)
            confidence = scores[class_id]
            if confidence > 0.3:
                # Object detected
                center_x = int(detection[0] * scaled_width)
                center_y = int(detection[1] * scaled_height)
                w = int(detection[2] * scaled_width)
                h = int(detection[3] * scaled_height)

                # Rectangle coordinates
                x = int(center_x - w / 2)
                y = int(center_y - h / 2)

                box_dimensions.append([x, y, w, h])
                box_confidences.append(float(confidence))
                class_ids.append(class_id)

    boxes = []
    # Non Maximum Suppression
    indexes = cv2.dnn.NMSBoxes(box_dimensions, box_confidences, 0.5, 0.4)
    for i in range(len(box_dimensions)):
        if i in indexes:
            x, y, w, h = box_dimensions[i]
            boxes.append({
                "x": x,
                "y": y,
                "w": w,
                "h": h,
                "confidence": float(box_confidences[i]),
                "class": str(classes[class_ids[i]])
            })

    # Sort boxes in descending sizes
    boxes = sorted(boxes, key=lambda box: box["w"] * box["h"], reverse=True)

    return {
        "statusCode": "200",
        "body": json.dumps({
            'boxes': boxes,
            'width': scaled_width,
            'height': scaled_height
        }),
        "headers": {'Access-Control-Allow-Origin': "*"}
    }
