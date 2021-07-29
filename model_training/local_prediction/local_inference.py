"""YOLO Object Detection - Local Inference

This script allows the user to obtain the output bounding boxes
for trained models, and save them to .txt files, 
and/or visualize them using opencv2.
"""

from base_inference import BaseInference, DEF_SCORE, DEF_NMS

import cv2
import numpy as np
import glob
import random
import argparse

from os.path import join
import os

DEF_WEIGHTS = join(os.pardir, os.pardir, "lambda_backend", "predict_microservice", "weights", "yolov4-tiny-obj.weights")
DEF_CONFIG = join(os.pardir, os.pardir, "lambda_backend", "predict_microservice", "weights", "yolov4-tiny-obj.cfg")
DEF_IMAGES = join(os.curdir, "test_images")
# Can read classes from a file if more are ever added
DEF_CLASSES = ["hold"]

class LocalInference(BaseInference):
    """
    Inference class for local predictions
    
    ...

    Attributes
    ----------
    images_path : str
        path to the test images folder
    will_save : bool
        to save predicted boxes for each image to .txt files
    will_show : bool
        to show predicted boxes for each image using opencv2

    Methods
    -------
    run()
        Obtains predicted boxes for visualization and/or saving to file
    """

    def __init__(self, weight_path, config_path, classes, score_thresh, nms_thresh, images_path, will_save, will_show, is_random):
        super().__init__(weight_path, config_path, classes, score_thresh, nms_thresh)
        
        self.images = glob.glob(join(images_path, "*.jpg"))

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

            class_ids, box_dims, box_confidences, dets, indexes = super().run(img)
            if self.will_save:
                self.save_labelfile(img_path, class_ids, dets, indexes)
            if self.will_show:
                self.show(img, class_ids, box_dims, indexes)
                cv2.destroyAllWindows()
    
    def show(self, img, class_ids, box_dims, indexes):
        font = cv2.FONT_HERSHEY_PLAIN
        
        for i in indexes:
            x, y, w, h = box_dims[i]
            label = str(self.classes[class_ids[i]])
            color = self.colors[class_ids[i]]
            cv2.rectangle(img, (x, y), (x + w, y + h), color, 2)
            cv2.putText(img, label, (x, y + 30), font, 1, color, 2)

        cv2.imshow("Image", img)
        key = cv2.waitKey(0)
    
    def save_labelfile(self, img_path, class_ids, dets, indexes):
        # Get filename for labelfile
        labelfile = os.path.splitext(img_path)[0]
        f = open(labelfile + ".txt", "w+")
        for i in indexes:
            class_id = class_ids[i]
            # Normalised format for yolo labeling
            nx, ny, nw, nh = dets[i]
            f.write(f'{class_id} {nx} {ny} {nw} {nh}\n')
        f.close()

def add_bool_arg(parser, name, default=True, help=""):
    group = parser.add_mutually_exclusive_group(required=False)
    group.add_argument('--' + name, dest=name, action='store_true', help=help)
    group.add_argument('--no-' + name, dest=name, action='store_false')
    parser.set_defaults(**{name:default})

def setup_parser():
    parser = argparse.ArgumentParser()
    parser.add_argument("-w", "--weights", help="path to learned weights from model", default=DEF_WEIGHTS)
    parser.add_argument("-c", "--config", help="path to config of yolo", default=DEF_CONFIG)
    parser.add_argument("-i", "--images", help="path to test images", default=DEF_IMAGES)
    parser.add_argument("-s", "--score", help="score threshold", default=DEF_SCORE, type=float)
    parser.add_argument("-n", "--nms", help="nms threshold", default=DEF_NMS, type=float)
    add_bool_arg(parser, 'save', help="save to labelfiles")
    add_bool_arg(parser, 'show', help="visualise using opencv2")
    add_bool_arg(parser, 'random', help="randomise image visualisation order")
    return parser

def main():
    # Parsing arguments
    parser = setup_parser()
    args = parser.parse_args()

    inference = LocalInference(
        weight_path   = args.weights, 
        config_path   = args.config, 
        classes       = DEF_CLASSES, # can add 
        score_thresh  = args.score, 
        nms_thresh    = args.nms, 
        images_path   = args.images, 
        will_save     = args.save, 
        will_show     = args.show,
        is_random     = args.random
        )
    inference.read_config()
    inference.initialize()
    inference.run()

if __name__ == "__main__":
    main()