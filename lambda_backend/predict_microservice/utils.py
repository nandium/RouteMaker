from requests_toolbelt.multipart import decoder
import cv2
import numpy as np

import io
import os

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
                "headers": get_response_headers()
            }

    return handler_with_exception


def retrieve_numpy_image(imageBytes):
    """Given an API Gateway event, validates the input data and returns the attached image attached in a numpy format

    Args:
        event (bytes): imageBytes

    Returns:
        Decoded Image: Numpy array of shape (height, width, channels)
    """
    return cv2.imdecode(np.frombuffer(imageBytes, np.uint8), -1)


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


def get_response_headers():
    if (os.environ.get("PYTHON_ENV") == 'prod'):
        return {
            'Access-Control-Allow-Origin': os.environ.get("ALLOWED_ORIGIN"),
            'Strict-Transport-Security': "max-age=31536000;"
        }
    else:
        return {'Access-Control-Allow-Origin': "*"}
