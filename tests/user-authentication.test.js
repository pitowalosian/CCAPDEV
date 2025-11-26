
jest.mock('mongoose', () => {
    const actual = jest.requireActual('mongoose');
    return {
        ...actual,
        connect: jest.fn().mockResolvedValue(),
    };
});

//mock user
jest.mock('../models/User', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn()
}));

const request = require('supertest');
const server = require('../server');        
const User = require("../models/User");


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

    // test 1: register
    test("POST /profile/register creates user and redirects to login", async () => {

        User.create.mockResolvedValue({
            firstname: "Juan",
            lastname: "Dela Cruz",
            email: "juan@example.com"
        });

        const res = await request(server)
            .post("/profile/register")   
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

    // test 2: successful login (normal user)
    test("POST /profile/login logs in normal user", async () => {

        User.findOne.mockResolvedValue(
            mockUser({ _id: "user123", email: "user@test.com", isAdmin: false }, true)
        );

        const res = await request(server)
            .post("/profile/login")        
            .send({
                email: "user@test.com",
                password: "valid"
            });

        expect(User.findOne).toHaveBeenCalledWith({ email: "user@test.com" });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/profile/User");
    });

    // test 3: successful login (admin)
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

    // test 4: failed login
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

    // test 5: log out
    test("GET /profile/logout destroys session and redirects to /login", async () => {

        const res = await request(server).get("/profile/logout");

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/login");
    });

});
