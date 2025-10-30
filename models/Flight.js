// models/Flight.js
const mongoose = require('mongoose');

// Define the schema for a Flight
const flightSchema = new mongoose.Schema({
    flightNo: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    airline: {
        type: String,
        required: true,
        trim: true
    },
    origin: {
        type: String,
        required: true,
        trim: true
    },
    destination: {
        type: String,
        required: true,
        trim: true
    },
    departureTime: {
        type: Date,
        required: true
    },
    arrivalTime: {
        type: Date,
        required: true
    },
    aircraftType: {
        type: String,
        required: true,
        trim: true
    },
    seatCap: {
        type: Number,
        required: true,
        trim: true
    }
});

// Export the model for use in other files
module.exports = mongoose.model('Flight', flightSchema);