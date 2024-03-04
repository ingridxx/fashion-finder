document.addEventListener('DOMContentLoaded', function() {
    updatePriceValue(document.getElementById('priceRange').value);
    // Update price display in real-time as the slider moves
    document.getElementById('priceRange').addEventListener('input', function() {
        updatePriceValue(this.value);
    });

    // Listen for clicks on drop area to trigger file selection
    document.getElementById('drop-area').addEventListener('click', function() {
        document.getElementById('fileElem').click();
    });

    // Attach an event listener to the Go button
    document.getElementById('goButton').addEventListener('click', function() {
        const fileInput = document.getElementById('fileElem');
        if (fileInput.files.length > 0) { 
            uploadFile(fileInput.files[0]); 
        } else {
            alert('Please select an image first.');
        }
    });   
});
  

function updatePriceValue(value) {
    // Format the value with a dollar sign and commas for thousands
    const formattedValue = '$' + parseInt(value).toLocaleString();
    document.getElementById('priceValue').textContent = formattedValue;
}
  
function handleFiles(files) {
    console.log("handleFiles called");
    if (files.length > 0) { // Check if any file was selected
        const file = files[0];
        
        // Create a FileReader instance
        const reader = new FileReader();

        // Event handler executed after the read completes
        reader.onload = function(e) {
            displayQueryImage(e.target.result); // e.target.result contains the image data
        };

        // Read the file as a Data URL (base64 encoded string)
        reader.readAsDataURL(file);
    }
}

function displayQueryImage(imageData) {
    const gallery = document.getElementById('gallery');
    gallery.innerHTML = `<img src="${imageData}" alt="Uploaded Image"/>`; // Display the image
}


function uploadFile(file) {
    const formData = new FormData();
    formData.append('image', file);

    const maxPrice = document.getElementById('priceRange').value;
    formData.append('maxPrice', maxPrice);

    document.getElementById('loadingSpinner').style.display = 'block';

    fetch('/upload', {
        method: 'POST',
        body: formData,
    })
    .then(response => response.json())
    .then(matches => {
        // Create a URL for the blob
        displayResult(matches);
    })
    .catch(error => {
        console.error('Error uploading the file:', error);
    });
}

function displayResult(matches) {
    document.getElementById('loadingSpinner').style.display = 'none'; // Hide the spinner
    if (matches.length > 0) {
        document.getElementById('resultsHeading').style.display = 'block'; // Show the heading
    } else {
        document.getElementById('resultsHeading').style.display = 'none'; // Hide the heading if no results
    }   

    const gallery = document.getElementById('gallery2');
    gallery.innerHTML = ''; // Clear existing content
    matches.forEach(match => {
        // Create a container for each match
        const matchElement = document.createElement('div');
        matchElement.classList.add('match');

        // Create and append the image element
        const imgElement = document.createElement('img');
        imgElement.src = match.image_cutout_url;
        imgElement.alt = 'Matched Image';
        matchElement.appendChild(imgElement);

        // Create and append the brand name element
        const brandElement = document.createElement('h3');
        brandElement.textContent = match.brand_name;
        matchElement.appendChild(brandElement);

        // Create and append the price element
        const priceElement = document.createElement('p');
        priceElement.textContent = `$${match.price}`;
        matchElement.appendChild(priceElement);

        // Create and append the description element
        const descElement = document.createElement('p');
        descElement.textContent = match.short_description;
        matchElement.appendChild(descElement);

        // Similarity score element
        const scoreElement = document.createElement('div');
        scoreElement.classList.add('similarity-score');
        scoreElement.textContent = `Similarity score: ${match.similarity_score.toFixed(2)}`;
        matchElement.appendChild(scoreElement);

        // Append the container to the gallery
        gallery.appendChild(matchElement);
    });
}