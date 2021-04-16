from requests_toolbelt.multipart import decoder
from PIL import Image
import numpy as np

import io

from functools import wraps


def exception_handler(handler):
    @wraps(handler)
    def handler_with_exception(*args, **kwargs):
        try:
            return handler(*args, **kwargs)
        except Exception as err:
            return {
                "statusCode": "400",
                "body": "Error: " + str(err),
                "headers": {'Access-Control-Allow-Origin': "*"}
            }

    return handler_with_exception


def retrieve_numpy_image(imageBinary):
    """Given an API Gateway event, validates the input data and returns the attached image attached in a numpy format

    Args:
        event (binary): imageBinary

    Returns:
        Decoded Image: Numpy array of shape (height, width, channels)
    """
    imageStream = io.BytesIO(imageBinary)
    imageFile = Image.open(imageStream)

    return np.array(imageFile)


def parse_multipart_data(body_dec, content_type):
    """Parser for transforming multipart form data into readable key value pairs

    Args:
        body_dec (byte),
        content_type (str)

    Returns:
        Parsed Form Data (list): List of key value pairs describing each form data
    """
    items = []

    for part in decoder.MultipartDecoder(body_dec, content_type).parts:
        disposition = part.headers[b'Content-Disposition']
        params = {}
        for dispPart in str(disposition).split(';'):
            kv = dispPart.split('=', 2)
            params[str(kv[0]).strip()] = str(kv[1]).strip(
                '\"\'\t \r\n') if len(kv) > 1 else str(kv[0]).strip()

        type = part.headers[b'Content-Type'].decode(
            "utf-8") if b'Content-Type' in part.headers else None
        items.append({"content": part.content, "type": type, "params": params})

    return items
