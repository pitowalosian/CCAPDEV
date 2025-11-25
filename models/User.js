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
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next(); // Only hash if password is new or modified
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ➕ Add method to compare password
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};


module.exports = mongoose.model("User", userSchema);
