from fashion_clip.fashion_clip import FashionCLIP
import pandas as pd
import numpy as np
import singlestoredb
import json

fclip = FashionCLIP('fashion-clip')

# Connect to SingleStore database
conn_params = {
  'host': 'svc-bd788f8f-c95e-470d-a767-462840795288-dml.aws-oregon-3.svc.singlestore.com',
  'user': 'admin',
  'password': 'Singlestore1',
  'database': 'vectordb',
  'port': 3306, 
}
connection = singlestoredb.connect(**conn_params)

# first 10k rows
path = '/Users/ingridxu/Downloads/archive (1)/current_farfetch_listings.csv'
skip_rows = list(range(1,24028))
articles = pd.read_csv(
    path,
    skiprows=skip_rows,
    nrows=10000  # Number of rows to read after skipping
)
# articles = pd.read_csv('/Users/ingridxu/Downloads/archive (1)/current_farfetch_listings.csv', nrows=10000)

columns_to_keep = ['Unnamed: 0', 'brand.name', 'gender', 'images.cutOut', 'images.model', 'priceInfo.finalPrice', 'shortDescription']
articles_filtered = articles[columns_to_keep]

model_images = articles['images.model'].tolist()
cutout_images = articles['images.cutOut'].tolist()
texts = articles['shortDescription'].tolist()

def safe_encode_images(fclip, model_image_url, cutout_image_url):
    try:
        # Attempt to encode both model and cutout images
        model_embedding = fclip.encode_images([model_image_url], batch_size=30)
        cutout_embedding = fclip.encode_images([cutout_image_url], batch_size=30)
        return model_embedding, cutout_embedding
    except Exception as e:
        print(f"Error encoding images: Model URL: {model_image_url}, CutOut URL: {cutout_image_url}. Error: {e}")
        return None, None

# Process and insert each article into the database
for index, row in articles_filtered.iterrows():
    model_image_url, cutout_image_url = row['images.model'], row['images.cutOut']
    model_embedding, cutout_embedding = safe_encode_images(fclip, model_image_url, cutout_image_url)
    
    if model_embedding is not None and cutout_embedding is not None:
        model_embedding_str = '[' + ','.join(map(str, model_embedding.flatten().tolist())) + ']'
        cutout_embedding_str = '[' + ','.join(map(str, cutout_embedding.flatten().tolist())) + ']'
        
        with connection.cursor() as cursor:
            sql = """
            INSERT INTO farfetch_listings (brand_name, gender, image_cutout_url, image_model_url, price, short_description, model_embedding, cutout_embedding)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(sql, (row['brand.name'], row['gender'], cutout_image_url, model_image_url, row['priceInfo.finalPrice'], row['shortDescription'], model_embedding_str, cutout_embedding_str))
            connection.commit()
            print("inserted!")

connection.close()




# successful_embeddings = []
# successful_texts = []

# # Initialize counters
# successful_count = 0
# skipped_count = 0

# # Assuming model_images, cutout_images, and texts are defined as before
# for model_image, cutout_image, text in zip(model_images, cutout_images, texts):
#     model_embedding, cutout_embedding = safe_encode_images(fclip, model_image, cutout_image)
#     if model_embedding is not None and cutout_embedding is not None:
#         # If both embeddings were successful, consider it a success and append the results
#         successful_embeddings.append((model_embedding, cutout_embedding))
#         successful_texts.append(text)
#         successful_count += 1
#     else:
#         # If either embedding failed, skip this item
#         skipped_count += 1

# # After processing all items, print the counts
# print(f"Total successful embeddings: {successful_count}")
# print(f"Total skipped images: {skipped_count}")


# def find_top_matches(unseen_image, fclip, successful_embeddings, successful_texts, top_k=3):
#     # Compute embeddings for the unseen image
#     unseen_model_embedding, unseen_cutout_embedding = safe_encode_images(fclip, unseen_image, unseen_image)
    
#     # Placeholder for combined scores
#     combined_scores = []
    
#     # Calculate combined dot product scores
#     for model_embedding, cutout_embedding in successful_embeddings:
#         model_score = np.dot(unseen_model_embedding.flatten(), model_embedding.flatten())
#         cutout_score = np.dot(unseen_cutout_embedding.flatten(), cutout_embedding.flatten())
#         combined_score = (model_score + cutout_score) / 2  # Averaging scores
#         combined_scores.append(combined_score)
    
#     # Get indices of top matches
#     top_indices = np.argsort(combined_scores)[-top_k:][::-1]  # Retrieves top_k indices with highest scores
    
#     # Retrieve and return top matches
#     top_matches = [(successful_texts[i], successful_embeddings[i]) for i in top_indices]
#     return top_matches

# # Example usage
# # Assume unseen_image_path is the path to your unseen image, and fclip is your model
# top_matches = find_top_matches(unseen_image_path, fclip, successful_embeddings, successful_texts, top_k=3)
# for text, (model_emb, cutout_emb) in top_matches:
#     print("Text:", text)
#     # Display images or further process here
