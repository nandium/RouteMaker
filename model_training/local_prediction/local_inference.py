"""YOLO Object Detection - Local Inference

This script allows the user to obtain the output bounding boxes
for trained models, and save them to .txt files, 
and/or visualize them using opencv2.
"""

from base_inference import BaseInference, CONFIDENCE_THRESHOLD, NMS_IOU_THRESHOLD

import cv2
import numpy as np
import glob
import random
import argparse

import os

DEFAULT_WEIGHTS = os.path.join(os.pardir, os.pardir, "lambda_backend", "predict_microservice", "weights", "yolov4-tiny-obj.weights")
DEFAULT_CONFIG = os.path.join(os.pardir, os.pardir, "lambda_backend", "predict_microservice", "weights", "yolov4-tiny-obj.cfg")
DEFAULT_IMAGES = os.path.join(os.curdir, "test_images")
# Can read classes from a file if more are ever added
DEFAULT_CLASSES = ["hold"]

IMSHOW_FONT = cv2.FONT_HERSHEY_PLAIN

class LocalInference(BaseInference):
    """
    Inference class for local predictions
    
    ...

    Attributes
    ----------
    images_path : str
        Path to the test images folder
    will_save : bool
        To save predicted boxes for each image to .txt files
    will_show : bool
        To show predicted boxes for each image using opencv2

    Methods
    -------
    run()
        Obtains predicted boxes for visualization and/or saving to file
    """

    def __init__(self, weight_path, config_path, classes, score_threshold, nms_thresh, images_path, will_save, will_show, is_random):
        super().__init__(weight_path, config_path, classes, score_threshold, nms_thresh)
        
        self.images = glob.glob(os.path.join(images_path, "*.jpg"))

        self.will_save = will_save
        self.will_show = will_show
        self.is_random = is_random

    def run(self):

        self.colors = np.random.uniform(0, 255, size=(len(self.classes), 3))
        
        if self.is_random:
            random.shuffle(self.images)

        for img_path in self.images:
            # Loading image
            img = cv2.imread(img_path)
            # img = cv2.resize(img, None, fx=0.6, fy=0.6)

            class_ids, box_dims, box_confidences, box_dims_norm, indexes = super().run(img)
            if self.will_save:
                self._save_labelfile(img_path, class_ids, box_dims_norm, indexes)
            if self.will_show:
                self._show(img, class_ids, box_dims, indexes)
                cv2.destroyAllWindows()
    
    def _show(self, img, class_ids, box_dims, indexes):        
        for i in indexes:
            x, y, w, h = box_dims[i]
            label = str(self.classes[class_ids[i]])
            color = self.colors[class_ids[i]]
            cv2.rectangle(img, (x, y), (x + w, y + h), color, 2)
            cv2.putText(img, label, (x, y + 30), IMSHOW_FONT, 1, color, 2)

        cv2.imshow("Image", img)
        key = cv2.waitKey(0)
    
    def _save_labelfile(self, img_path, class_ids, box_dims_norm, indexes):
        # Get filename for labelfile
        labelfile = os.path.splitext(img_path)[0]
        with open(labelfile + ".txt", "w+") as f:
            for i in indexes:
                class_id = class_ids[i]
                # Normalised format for yolo labeling
                nx, ny, nw, nh = box_dims_norm[i]
                f.write(f'{class_id} {nx} {ny} {nw} {nh}\n')

def add_bool_arg(parser, name, default=True, msg=""):
    group = parser.add_mutually_exclusive_group(required=False)
    group.add_argument('--' + name, dest=name, action='store_true', help=msg)
    group.add_argument('--no-' + name, dest=name, action='store_false')
    parser.set_defaults(**{name:default})

def setup_parser():
    parser = argparse.ArgumentParser()
    parser.add_argument("-w", "--weights", help="path to learned weights from model", default=DEFAULT_WEIGHTS)
    parser.add_argument("-c", "--config", help="path to config of yolo", default=DEFAULT_CONFIG)
    parser.add_argument("-i", "--images", help="path to test images", default=DEFAULT_IMAGES)
    parser.add_argument("-s", "--score", help="score threshold", default=CONFIDENCE_THRESHOLD, type=float)
    parser.add_argument("-n", "--nms", help="nms threshold", default=NMS_IOU_THRESHOLD, type=float)
    add_bool_arg(parser, 'save', msg="save to labelfiles")
    add_bool_arg(parser, 'show', msg="visualise using opencv2")
    add_bool_arg(parser, 'random', msg="randomise image visualisation order")
    return parser

def main():
    # Parsing arguments
    parser = setup_parser()
    args = parser.parse_args()

    inference = LocalInference(
        weight_path   = args.weights, 
        config_path   = args.config, 
        classes       = DEFAULT_CLASSES,
        score_threshold  = args.score, 
        nms_thresh    = args.nms, 
        images_path   = args.images, 
        will_save     = args.save, 
        will_show     = args.show,
        is_random     = args.random
    )
    inference.run()

if __name__ == "__main__":
    main()
