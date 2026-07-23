const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const app = express();

// Database Connection
const connection = mysql.createConnection({
    host: 'c237-annie-mysql.mysql.database.azure.com',
    user: 'c237_020',
    password: 'c237020@2026!',
    database: 'c237_020_ca2team2',
    ssl: {
        rejectUnauthorized: false
    }
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});



// ===============================
// Express Settings
// ===============================
app.set("view engine", "ejs");

app.use(express.static("public"));

app.use(express.urlencoded({
    extended: false
}));


// ===============================
// Session
// ===============================
app.use(session({
    secret: "secret",
    resave: false,
    saveUninitialized: false
}));

app.use(flash());


// ===============================
// Authentication Middleware
// ===============================

// Check if user is logged in
const checkAuthenticated = (req, res, next) => {

    if (req.session.user) {
        return next();
    }

    res.redirect("/login");
};


// Check if logged in user is Admin
const checkAdmin = (req, res, next) => {

    if (!req.session.user) {
        return res.redirect("/login");
    }

    if (req.session.user.role === "admin") {
        return next();
    }

    res.send("Access Denied. Admin only.");
};


// Get the primary key value of the logged-in user, regardless of whether
// the users table calls it "userId" or "id"
const getUserId = (user) => (user ? (user.userId ?? user.id) : null);


// ===============================
// HOME PAGE
// ===============================
app.get("/", (req, res) => {
    res.render("index", {
        user: req.session.user
    });
});


// ===================================================
// TIARA
// Registration/Login/Logout
// ===================================================

// Display Login Page
app.get("/login", (req, res) => {
    res.render("login");
});

// Display Sign Up Page
app.get("/signup", (req, res) => {
    res.render("signup");
});

// Display Forgot Password Page (optional)
app.get("/forgot", (req, res) => {
    res.render("forgot");
});

// Login
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const sql = "SELECT * FROM users WHERE username = ? AND password = SHA1(?)";
    connection.query(sql, [username, password], (err, results) => {
        if (err) {
            console.log(err);
            return res.send("Database Error");
        }
        if (results.length === 0) {
            return res.send("Invalid username or password.");
        }
        req.session.user = results[0];
        res.redirect("/");
    });
});

// Register
app.post("/signup", (req, res) => {
    const {
        username,
        email,
        password,
        confirmPassword,
        contact,
        role
    } = req.body;

    if (password !== confirmPassword) {
        return res.send("Passwords do not match.");
    }
    const checkSql = "SELECT * FROM users WHERE username = ? OR email = ?";

    connection.query(checkSql, [username, email], (err, results) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }
        if (results.length > 0) {
            return res.send("Username or email already exists.");
        }

        const insertSql = `
            INSERT INTO users (username, email, password, contact, role)
            VALUES (?, ?, SHA1(?), ?, ?)`;

        connection.query(insertSql, [username, email, password, contact, role], (err) => {

            if (err) {
                console.log(err);
                return res.send("Database Error");
            }

            res.redirect("/login");

        });
    });

});

// Logout
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});


// ===================================================
// HARINI,viewing of display

app.get("/events", (req, res) => {

    const { keyword, dateFrom, dateTo, sortBy } = req.query;

    let sql = "SELECT *, DATE_FORMAT(eventDate, '%Y-%m-%d') AS formattedDate FROM events WHERE 1=1";
    const params = [];

    if (keyword && keyword.trim() !== "") {
        sql += " AND (eventName LIKE ? OR location LIKE ? OR description LIKE ?)";
        const like = "%" + keyword.trim() + "%";
        params.push(like, like, like);
    }

    if (dateFrom) {
        sql += " AND eventDate >= ?";
        params.push(dateFrom);
    }

    if (dateTo) {
        sql += " AND eventDate <= ?";
        params.push(dateTo);
    }

    const sortOptions = {
        date_asc: "eventDate ASC",
        date_desc: "eventDate DESC",
        name_asc: "eventName ASC",
        name_desc: "eventName DESC"
    };

    sql += " ORDER BY " + (sortOptions[sortBy] || "eventDate ASC");

    connection.query(sql, params, (err, results) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        const userId = getUserId(req.session.user);

        // Not logged in - nothing is registered, render straight away
        if (!userId) {
            return res.render("events", {
                events: results,
                filters: { keyword, dateFrom, dateTo, sortBy },
                user: req.session.user,
                registeredIds: []
            });
        }

        // Logged in - find which of these events the user has already selected
        connection.query(
            "SELECT eventId FROM registrations WHERE userId = ?",
            [userId],
            (err2, regResults) => {

                if (err2) {
                    console.log(err2);
                    return res.send("Database Error");
                }

                res.render("events", {
                    events: results,
                    filters: { keyword, dateFrom, dateTo, sortBy },
                    user: req.session.user,
                    registeredIds: regResults.map(r => r.eventId)
                });

            }
        );

    });

});

// GET /events/:id - View single event details
app.get("/events/:id", (req, res) => {
    const id = req.params.id;
    const sql = "SELECT *, DATE_FORMAT(eventDate, '%W, %M %d, %Y') AS formattedDate FROM events WHERE eventId = ?";

    connection.query(sql, [id], (err, results) => {
        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        if (results.length === 0) {
            return res.send("Event not found.");
        }

        const userId = getUserId(req.session.user);

        if (!userId) {
            return res.render("eventDetails", {
                event: results[0],
                user: req.session.user,
                isRegistered: false
            });
        }

        connection.query(
            "SELECT * FROM registrations WHERE userId = ? AND eventId = ?",
            [userId, id],
            (err2, regResults) => {

                if (err2) {
                    console.log(err2);
                    return res.send("Database Error");
                }

                res.render("eventDetails", {
                    event: results[0],
                    user: req.session.user,
                    isRegistered: regResults.length > 0
                });

            }
        );
    });
});
// ===================================================


// ===================================================
// Attend / My Events
// Select events to attend and view them on a dedicated page
// ===================================================

// Register (select) the logged-in user for an event
app.post("/events/:id/register", checkAuthenticated, (req, res) => {

    const eventId = req.params.id;
    const userId = getUserId(req.session.user);

    const sql = "INSERT IGNORE INTO registrations (userId, eventId) VALUES (?, ?)";

    connection.query(sql, [userId, eventId], (err) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        res.redirect(req.get("Referrer") || "/events");

    });

});

// Unregister the logged-in user from an event
app.post("/events/:id/unregister", checkAuthenticated, (req, res) => {

    const eventId = req.params.id;
    const userId = getUserId(req.session.user);

    const sql = "DELETE FROM registrations WHERE userId = ? AND eventId = ?";

    connection.query(sql, [userId, eventId], (err) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        res.redirect(req.get("Referrer") || "/events");

    });

});

// View all events the logged-in user has selected to attend
app.get("/myEvents", checkAuthenticated, (req, res) => {

    const userId = getUserId(req.session.user);

    const sql = `
        SELECT events.*, DATE_FORMAT(events.eventDate, '%Y-%m-%d') AS formattedDate
        FROM registrations
        JOIN events ON registrations.eventId = events.eventId
        WHERE registrations.userId = ?
        ORDER BY events.eventDate ASC`;

    connection.query(sql, [userId], (err, results) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        res.render("myEvents", {
            events: results,
            user: req.session.user
        });

    });

});

// ===================================================


// ===================================================
// JANELLE
// Add Event
// ===================================================
app.get("/addEvent", checkAdmin, (req, res) => {
    res.render("addEvent", {
        messages: req.flash()
    });
});

app.post("/addEvent", checkAdmin, (req, res) => {
    const { eventName, eventDate, location, description } = req.body;

    if (!eventName || !eventDate || !location || !description) {
        req.flash("error", "All fields are required.");
        return res.redirect("/addEvent");
    }

    const sql = `
    INSERT INTO events
    (eventName, eventDate, location, description)
    VALUES
    (?, ?, ?, ?)`;

    connection.query(sql, [eventName, eventDate, location, description], (err) => {
        if (err) {
            console.log(err);
            return res.send("Database Error");
        }
        res.redirect("/events");
    });
});


// ===================================================
// CHLOE
// Edit Event
// ===================================================

// ===============================
// EDIT EVENT (Display Edit Form)
// ===============================
app.get("/editEvent/:id", checkAdmin, (req, res) => {

    const id = req.params.id;

    const sql = "SELECT *, DATE_FORMAT(eventDate, '%Y-%m-%d') AS formattedDate FROM events WHERE eventId = ?";

    connection.query(sql, [id], (err, results) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        if (results.length === 0) {
            return res.send("Event not found.");
        }

        res.render("editEvent", {
            event: results[0]
        });

    });

});


// ===============================
// UPDATE EVENT
// ===============================
app.post("/editEvent/:id", checkAdmin, (req, res) => {

    const id = req.params.id;

    const {
        eventName,
        eventDate,
        location,
        description
    } = req.body;

    const sql = `
UPDATE events
SET
    eventName=?,
    eventDate=?,
    location=?,
    description=?
WHERE eventId=?`;

    connection.query(
        sql,
        [
            eventName,
            eventDate,
            location,
            description,
            id
        ],
        (err) => {

            if (err) {
                console.log(err);
                return res.send("Database Error");
            }

            res.redirect("/events");
        }
    );

});

// ===================================================
// RONAN
// Delete Event
// ===================================================
app.post("/deleteEvent/:id", checkAdmin, (req, res) => {

    const id = req.params.id;

    const sql = "DELETE FROM events WHERE eventId = ?";

    connection.query(sql, [id], (err) => {

        if (err) {
            console.log(err);
            return res.send("Database Error");
        }

        // Return to the Events page after deleting
        res.redirect("/events");

    });

});



// ===================================================



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port http://localhost:${PORT}`));
