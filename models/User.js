const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
    firstname: { type: String, required: true },
    lastname:  { type: String, required: true },
    email:     { type: String, required: true, unique: true },
    password:  { type: String, required: true },
    isAdmin:   { type: Boolean, default: false }
});

// 🔐 Pre-save hook to hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return; // Only hash if password is new or modified
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// ➕ Add method to compare password
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
