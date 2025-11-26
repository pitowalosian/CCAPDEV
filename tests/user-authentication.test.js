// ==========================================
// 1. MOCK MONGOOSE BEFORE IMPORTING SERVER
// ==========================================
jest.mock('mongoose', () => {
    const actual = jest.requireActual('mongoose');
    return {
        ...actual,
        connect: jest.fn().mockResolvedValue(),
    };
});

// ==========================================
// 2. MOCK USER MODEL
// ==========================================
jest.mock('../models/User', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn()
}));

// ==========================================
// 3. IMPORTS AFTER MOCKS
// ==========================================
const request = require('supertest');
const server = require('../server');        // <-- USE THIS
const User = require("../models/User");

// Helper: mock user with async comparePassword
function mockUser(data, matchPassword) {
    return {
        ...data,
        comparePassword: jest.fn().mockResolvedValue(matchPassword)
    };
}

describe("User Authentication Tests", () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // -------------------------------------------------
    // Registration
    // -------------------------------------------------
    test("POST /profile/register creates user and redirects to login", async () => {

        User.create.mockResolvedValue({
            firstname: "Juan",
            lastname: "Dela Cruz",
            email: "juan@example.com"
        });

        const res = await request(server)
            .post("/profile/register")   // <-- FIXED ROUTE
            .send({
                firstname: "Juan",
                lastname: "Dela Cruz",
                email: "juan@example.com",
                password: "12345"
            });

        expect(User.create).toHaveBeenCalledTimes(1);
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/profile/login?registered=true");
    });

    // -------------------------------------------------
    // Normal user login
    // -------------------------------------------------
    test("POST /profile/login logs in normal user", async () => {

        User.findOne.mockResolvedValue(
            mockUser({ _id: "user123", email: "user@test.com", isAdmin: false }, true)
        );

        const res = await request(server)
            .post("/profile/login")        // <-- FIXED ROUTE
            .send({
                email: "user@test.com",
                password: "valid"
            });

        expect(User.findOne).toHaveBeenCalledWith({ email: "user@test.com" });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/profile/User");
    });

    // -------------------------------------------------
    // Admin login
    // -------------------------------------------------
    test("POST /profile/login logs in admin successfully", async () => {

        User.findOne.mockResolvedValue(
            mockUser({ _id: "admin123", email: "admin@test.com", isAdmin: true }, true)
        );

        const res = await request(server)
            .post("/profile/login")
            .send({
                email: "admin@test.com",
                password: "adminpass"
            });

        expect(User.findOne).toHaveBeenCalledWith({ email: "admin@test.com" });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/profile/Admin");
    });

    // -------------------------------------------------
    // Failed login
    // -------------------------------------------------
    test("POST /profile/login rejects incorrect password", async () => {

        User.findOne.mockResolvedValue(
            mockUser({ email: "wrong@test.com", isAdmin: false }, false)
        );

        const res = await request(server)
            .post("/profile/login")
            .send({
                email: "wrong@test.com",
                password: "bad"
            });

        expect(res.status).toBe(401);
        expect(res.text).toMatch(/Invalid login/i);
    });

    // -------------------------------------------------
    // Logout
    // -------------------------------------------------
    test("GET /profile/logout destroys session and redirects to /login", async () => {

        const res = await request(server).get("/profile/logout");

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/login");
    });

});
