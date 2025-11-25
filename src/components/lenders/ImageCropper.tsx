import { useState, useRef, useEffect } from "react";
import ReactCrop, { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X } from "lucide-react";

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

export default function ImageCropper({
  imageSrc,
  onCropComplete,
  onCancel,
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>({
    unit: "%",
    width: 90,
    height: 90,
    x: 5,
    y: 5,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [processing, setProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Initialize with a square crop centered on the image
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      const size = Math.min(width, height) * 0.9;
      const x = (width - size) / 2;
      const y = (height - size) / 2;
      
      setCrop({
        unit: "px",
        width: size,
        height: size,
        x,
        y,
      });
    }
  }, [imageSrc]);

  const getCroppedImage = async (
    image: HTMLImageElement,
    crop: PixelCrop
  ): Promise<Blob> => {
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    // Set desired output size (256x256 for consistent logo size)
    const outputSize = 256;
    canvas.width = outputSize;
    canvas.height = outputSize;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("No 2d context");
    }

    // Draw the cropped image scaled to the output size
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      outputSize,
      outputSize
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas is empty"));
            return;
          }
          resolve(blob);
        },
        "image/png",
        1
      );
    });
  };

  const handleCropComplete = async () => {
    if (!completedCrop || !imgRef.current) return;

    setProcessing(true);
    try {
      const croppedBlob = await getCroppedImage(imgRef.current, completedCrop);
      onCropComplete(croppedBlob);
    } catch (error) {
      console.error("Error cropping image:", error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 rounded-lg p-4 max-h-[400px] overflow-auto flex items-center justify-center">
        <ReactCrop
          crop={crop}
          onChange={(c) => setCrop(c)}
          onComplete={(c) => setCompletedCrop(c)}
          aspect={1}
          circularCrop={false}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Crop preview"
            className="max-w-full max-h-[350px]"
          />
        </ReactCrop>
      </div>
      
      <p className="text-sm text-muted-foreground text-center">
        Adjust the crop area to select the logo. It will be resized to 256×256px.
      </p>
      
      <div className="flex gap-2">
        <Button
          onClick={onCancel}
          variant="outline"
          className="flex-1"
          disabled={processing}
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button
          onClick={handleCropComplete}
          className="flex-1"
          disabled={!completedCrop || processing}
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Crop & Upload
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
