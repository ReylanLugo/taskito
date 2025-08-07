# CSRF Protection Implementation

This document describes the CSRF (Cross-Site Request Forgery) protection implemented in the Taskito FastAPI application.

## Overview

The application uses **Double Submit Cookie Pattern** for CSRF protection, which is the most secure and modern approach for APIs using JWT authentication.

## How It Works

### 1. Token Generation
- CSRF tokens are generated on authenticated GET requests
- Tokens are signed with HMAC-SHA256 using the application's secret key
- Tokens are stored in secure cookies and returned in response headers

### 2. Token Validation
- All state-changing HTTP methods (POST, PUT, DELETE, PATCH) require CSRF validation
- The middleware validates that the cookie token matches the header token
- Authentication endpoints and public endpoints skip CSRF validation

### 3. Security Features
- **Signed tokens**: Prevents token tampering
- **SameSite cookies**: Prevents CSRF attacks from third-party sites
- **Secure cookies**: HTTPS-only in production
- **Token expiration**: 1-hour lifetime
- **HMAC verification**: Cryptographic signature validation

## API Endpoints

### Get CSRF Token
```http
GET /csrf/token
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "csrf_token": "generated_token_here",
  "message": "CSRF token generated successfully"
}
```

**Headers:**
- `X-CSRF-Token`: Raw token for header usage
- `Set-Cookie`: Signed token cookie

### Validate CSRF Token
```http
GET /csrf/validate
Authorization: Bearer <jwt_token>
X-CSRF-Token: <token_from_header>
Cookie: csrf_token=<signed_token_from_cookie>
```

**Response:**
```json
{
  "valid": true,
  "message": "CSRF tokens present and will be validated"
}
```

## Frontend Integration

### 1. Initial Setup
```javascript
// Get CSRF token on app load
const getCSRFToken = async () => {
  const response = await fetch('/csrf/token', {
    headers: {
      'Authorization': `Bearer ${jwtToken}`
    }
  });
  const data = await response.json();
  return data.csrf_token;
};
```

### 2. Making Protected Requests
```javascript
// For POST, PUT, DELETE requests
const createTask = async (taskData) => {
  const csrfToken = await getCSRFToken();
  
  const response = await fetch('/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`,
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify(taskData),
    credentials: 'include' // Important for cookies
  });
  
  return response.json();
};
```

### 3. Automatic Token Renewal
```javascript
// The middleware automatically sets new tokens on GET requests
// You can also manually refresh tokens:
const refreshCSRFToken = async () => {
  const response = await fetch('/csrf/token', {
    headers: { 'Authorization': `Bearer ${jwtToken}` },
    credentials: 'include'
  });
  return response.json().csrf_token;
};
```

## Testing

### Running CSRF Tests
```bash
# Run all tests including CSRF tests
pytest tests/test_csrf.py -v

# Run with coverage
pytest tests/test_csrf.py --cov=app.middleware.csrf -v
```

### Test Scenarios Covered
- ✅ Token generation and validation
- ✅ Protected endpoint access
- ✅ Invalid token rejection
- ✅ Missing token handling
- ✅ Safe method bypass (GET, HEAD, OPTIONS)
- ✅ Authentication endpoint bypass
- ✅ Token renewal on GET requests

## Security Considerations

### 1. HTTPS Only
In production, ensure HTTPS is enabled for secure cookie transmission.

### 2. Token Storage
- **Cookie**: Signed token for server validation
- **Header**: Raw token for client usage
- **JavaScript**: Never store tokens in localStorage/sessionStorage

### 3. SameSite Attribute
Cookies use `SameSite=Strict` to prevent CSRF attacks from third-party sites.

### 4. Token Lifetime
Tokens expire after 1 hour and are automatically renewed on GET requests.

## Configuration

### Environment Variables
The CSRF protection uses your existing `SECRET_KEY` from environment variables.

### Customization
You can modify these settings in `app/middleware/csrf.py`:
- Token lifetime
- Cookie name
- Header name
- Secure cookie settings

## Troubleshooting

### Common Issues

1. **"CSRF token missing"**
   - Ensure you're including the `X-CSRF-Token` header
   - Check that cookies are being sent with requests

2. **"Invalid CSRF token"**
   - Verify the cookie and header tokens match
   - Check for token expiration (1 hour lifetime)

3. **CORS Issues**
   - Ensure your frontend origin is allowed in CORS settings
   - Check that credentials are included in requests

### Debug Mode
For development, you can temporarily disable CSRF protection by setting:
```python
# In app/middleware/csrf.py
_should_skip_csrf = True  # Add debug condition
```

## Migration from Previous Implementation

If you previously used `fastapi-csrf-protect`, this implementation:
- ✅ Provides better security with signed tokens
- ✅ Integrates seamlessly with JWT authentication
- ✅ Has simpler frontend integration
- ✅ Includes comprehensive testing
- ✅ Uses modern security practices

## Security Audit Checklist

- [ ] HTTPS enabled in production
- [ ] Secure cookie attributes set
- [ ] Token validation working
- [ ] Rate limiting active
- [ ] CORS properly configured
- [ ] All tests passing
- [ ] Frontend integration tested

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [FastAPI Security Best Practices](https://fastapi.tiangolo.com/tutorial/security/)
- [Double Submit Cookie Pattern](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie)


