from fashion_clip.fashion_clip import FashionCLIP
import json
import sys

def generate_embedding(image_path):
    fclip = FashionCLIP('fashion-clip')
    embeddings = fclip.encode_images([image_path], batch_size=1)
    embedding = embeddings[0]
    embedding_list = embedding.tolist() if hasattr(embedding, 'tolist') else embedding
    print(json.dumps(embedding_list))

if __name__ == '__main__':
    image_path = sys.argv[1]
    generate_embedding(image_path)