const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

mongoose.connect('mongodb://127.0.0.1:27017/flightdb')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error: ', err));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'FlightSearch.html'));
});
// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

