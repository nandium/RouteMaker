from base_inference import BaseInference

class ServiceInference(BaseInference):
    """
    Inference class for predictions on predict_microservice
    
    ...

    Methods
    -------
    run(img, width_dict)
        Obtains predicted boxes for predict_microservice
    """

    def run(self, img, scaled_width):
        """
        Parameters
        ----------
        img : cv2.Mat
            Image as a matrix
        scaled_width : int
            Scaled width of images
        
        Returns
        -------
        scaled_height : int
            Scaled height of img
        scaled_width : int
            Scaled width of img
        boxes : list
            List of predicted boxes in JSON format
        """

        height, width = img.shape
        # If given width is 0, do not scale
        scaled_width = scaled_width if scaled_width != 0 else width
        scaled_height = int((scaled_width / width) * height)

        class_ids, box_dims, box_confidences, _, indexes = super().run(img, scaled_height, scaled_width)

        boxes = self._get_boxes_dict(box_dims, box_confidences, class_ids, indexes)
        return scaled_height, scaled_width, boxes

    def _get_boxes_dict(self, box_dims, box_confidences, class_ids, indexes):
        """
        Parameters
        ----------
        box_dims : list
            Dimensions of predicted boxes
        box_confidences : list
            Confidence scores of predicted boxes
        class_ids : list
            Class IDs of predicted boxes
        indexes : list
            Indexes of predicted boxes after NMS
        
        Returns
        -------
        boxes : list
            List of predicted boxes in JSON format
        """

        boxes = []
        for i in indexes:
            i = int(i)
            x, y, w, h = box_dims[i]
            boxes.append({
                "x": x,
                "y": y,
                "w": w,
                "h": h,
                "confidence": float(box_confidences[i]),
                "class": str(self.classes[class_ids[i]])
            })

        # Sort boxes in descending sizes
        boxes = sorted(boxes, key=lambda box: box["w"] * box["h"], reverse=True)

        return boxes
