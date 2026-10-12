import re

with open("frontend/src/pages/signup.jsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add dob and gender to state
content = content.replace(
    "name: '', email: '', mobile_number: '',",
    "name: '', email: '', mobile_number: '', dob: '', gender: '',"
)

# Update minimum characters to 6
content = content.replace("Minimum 8 characters", "Minimum 6 characters")
content = content.replace("/.{8,}/", "/.{6,}/")

# Add dob and gender to form UI
new_fields = """
            <Field id="dob" label="Date of Birth" type="date" value={form.dob} onChange={(v) => update('dob', v)} required />
            <div>
              <label className="field-label">Gender<span className="text-clay ml-1">*</span></label>
              <select className="input" value={form.gender} onChange={(e) => update('gender', e.target.value)} required>
                <option value="" disabled>Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Non-binary">Non-binary</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
"""

content = content.replace("<div className=\"pt-1 pb-1 border-t border-line\" />", new_fields + "\n            <div className=\"pt-1 pb-1 border-t border-line\" />", 1)

with open("frontend/src/pages/signup.jsx", "w", encoding="utf-8") as f:
    f.write(content)
