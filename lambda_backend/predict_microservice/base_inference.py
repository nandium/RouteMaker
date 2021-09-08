import cv2
import numpy as np
from configparser import RawConfigParser

CONFIDENCE_THRESHOLD = 0.3
NMS_IOU_THRESHOLD = 0.4
SCALE_FACTOR = 0.00392

class BaseInference:
    """
    Base Inference class for predictions
    
    ...

    Attributes
    ----------
    weight_path : str
        path to the .weights file
    config_path : str
        path to the .cfg file
    classes : list
        names of classes detected
    score_threshold : float
        threshold to classify object as detected
    nms_threshold : float
        threshold for non-max suppression

    Methods
    -------
    run()
        Obtains predicted boxes 
    """

    def __init__(self, weight_path, config_path, classes, score_threshold=None, nms_thresh=None):
        self.weight_path = weight_path
        self.config_path = config_path
        self.classes = classes
        self.net = None
        self.score_threshold = score_threshold if score_threshold is not None else CONFIDENCE_THRESHOLD
        self.nms_thresh = nms_thresh if nms_thresh is not None else NMS_IOU_THRESHOLD

        self._initialize_model()
        self._read_config()
    
    def _initialize_model(self):
        # Load Yolo
        self.net = cv2.dnn.readNet(
            self.weight_path,
            self.config_path
        )
        layer_names = self.net.getLayerNames()
        # Gets the indexes of layers with unconnected outputs, 
        # then stores the associated names into output_layers
        self.output_layers = [layer_names[i[0] - 1] for i in self.net.getUnconnectedOutLayers()]
    
    def _read_config(self):
        cfg = RawConfigParser(strict=False)
        cfg.read(self.config_path)

        assert 'net' in cfg, 'No net section in config'

        net_dict = dict(cfg.items('net'))

        assert 'height' in net_dict and 'weight' in net_dict, 'No height and/or weight in config'
        self.train_height_width = (int(net_dict['height']), int(net_dict['width']))

    def run(self, img, height=None, width=None):
        """
        Parameters
        ----------
        img : cv2.Mat
            Image as a matrix
        height : int, optional
            Height of img (default is None)
        width : int, optional
            Width of img (default is None)
        
        Returns
        -------
        class_ids : list(int)
            Class IDs of boxes
        box_dims : list(list(int))
            Dimensions of boxes
        box_confidences : list(float)
            Confidence scores of boxes
        box_dims_norm : list(list(float))
            Normalised dimensions of boxes
        indexes : list(int)
            Indexes of boxes that passed NMS
        """        

        # If run is called without height or width given
        if height is None or width is None:
            height, width, channels = img.shape

        # Detecting objects
        blob = cv2.dnn.blobFromImage(
            image       = img, 
            scalefactor = SCALE_FACTOR, 
            size        = self.train_height_width, 
            mean        = (0,0,0), 
            swapRB      = True, 
            crop        = False
        )

        self.net.setInput(blob)
        outs = self.net.forward(self.output_layers)
        
        class_ids, box_dims, box_confidences, box_dims_norm, indexes = self._get_filtered_boxes(outs, height, width)

        return class_ids, box_dims, box_confidences, box_dims_norm, indexes

    def _get_filtered_boxes(self, output, height, width):
        # Showing informations on the screen
        class_ids = []
        box_confidences = []
        box_dims = []
        # Saving to txt
        box_dims_norm = []

        for out in output:
            for detection in out:
                
                scores = detection[5:]
                class_id = np.argmax(scores)
                confidence = scores[class_id]
                if confidence > self.score_threshold:
                    # Object detected
                    center_x = int(detection[0] * width)
                    center_y = int(detection[1] * height)
                    w = int(detection[2] * width)
                    h = int(detection[3] * height)

                    # Rectangle coordinates
                    x = int(center_x - w / 2)
                    y = int(center_y - h / 2)

                    box_dims.append([x, y, w, h])
                    box_confidences.append(float(confidence))
                    class_ids.append(class_id)

                    # Save normalised format
                    box_dims_norm.append(detection[:4])

        indexes = cv2.dnn.NMSBoxes(box_dims, box_confidences, self.score_threshold, self.nms_thresh)
        indexes = [int(i) for i in indexes]
        
        return class_ids, box_dims, box_confidences, box_dims_norm, indexes
