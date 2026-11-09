const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function requireAuth(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required",
    });
  }

  const token = authorization.slice(7);

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET,
      { algorithms: ["HS256"] }
    );

    if (
      typeof payload.sub !== "string" ||
      !payload.sub
    ) {
      return res.status(401).json({
        message: "Invalid token",
      });
    }

    const user = await User.findById(payload.sub)
      .select("_id name email");

    if (!user) {
      return res.status(401).json({
        message: "User no longer exists",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired",
      });
    }

    if (
      error.name === "JsonWebTokenError" ||
      error.name === "CastError"
    ) {
      return res.status(401).json({
        message: "Invalid token",
      });
    }

    next(error);
  }
}

module.exports = requireAuth;