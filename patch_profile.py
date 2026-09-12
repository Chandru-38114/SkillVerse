with open("frontend/src/pages/profile.jsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("at least 8 characters", "at least 6 characters")

# Add dob, gender, and age displays
new_fields = """
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="field-label">Date of Birth</label>
                  <input type="text" className="input bg-sand/50 cursor-not-allowed" value={user.dob || 'Not provided'} disabled />
                </div>
                <div>
                  <label className="field-label">Gender</label>
                  <input type="text" className="input bg-sand/50 cursor-not-allowed" value={user.gender || 'Not provided'} disabled />
                </div>
                <div>
                  <label className="field-label">Age</label>
                  <input type="text" className="input bg-sand/50 cursor-not-allowed" value={user.age !== null && user.age !== undefined ? user.age : 'Not provided'} disabled />
                </div>
              </div>
"""

content = content.replace("<div className=\"grid grid-cols-1 sm:grid-cols-2 gap-4\">\n                <div>\n                  <label className=\"field-label\">Mobile Number</label>", new_fields + "\n              <div className=\"grid grid-cols-1 sm:grid-cols-2 gap-4\">\n                <div>\n                  <label className=\"field-label\">Mobile Number</label>")

with open("frontend/src/pages/profile.jsx", "w", encoding="utf-8") as f:
    f.write(content)
