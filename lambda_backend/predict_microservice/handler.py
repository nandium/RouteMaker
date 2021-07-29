from os.path import join
import json
import base64

from utils import exception_handler, retrieve_numpy_image, parse_multipart_data, get_response_headers
from service_inference import ServiceInference

DEF_WEIGHTS = join("weights", "yolov4-tiny-obj.weights")
DEF_CONFIG = join("weights", "yolov4-tiny-obj.cfg")
DEF_CLASSES = ["hold"]

ALLOWED_TYPES = ["image/jpeg"]

def setup():
    inference = ServiceInference(DEF_WEIGHTS, DEF_CONFIG, DEF_CLASSES)
    inference.initialize()
    inference.read_config()
    return inference

inference = setup()

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

    # Run inference on image
    scaled_height, scaled_width, boxes = inference.run(img, width_dict)

    return {
        "statusCode": "200",
        "body": json.dumps({
            'boxes': boxes,
            'width': scaled_width,
            'height': scaled_height
        }),
        "headers": get_response_headers()
    }
