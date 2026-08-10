package com.bookworld.zm;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;

public class LoginActivity extends AppCompatActivity {

    private EditText emailField, passwordField;
    private Button loginBtn, gotoRegBtn;
    private FirebaseAuth mAuth;
    private FirebaseFirestore db;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        mAuth = FirebaseAuth.getInstance();
        db = FirebaseFirestore.getInstance();

        emailField = findViewById(R.id.login_email);
        passwordField = findViewById(R.id.login_password);
        loginBtn = findViewById(R.id.btn_login);
        gotoRegBtn = findViewById(R.id.btn_goto_register);

        loginBtn.setOnClickListener(v -> loginUser());
        gotoRegBtn.setOnClickListener(v -> startActivity(new Intent(LoginActivity.this, RegisterActivity.class)));
    }

    private void loginUser() {
        String email = emailField.getText().toString().trim();
        String password = passwordField.getText().toString().trim();

        if (TextUtils.isEmpty(email) || TextUtils.isEmpty(password)) {
            Toast.makeText(this, "Empty credentials", Toast.LENGTH_SHORT).show();
            return;
        }

        mAuth.signInWithEmailAndPassword(email, password)
            .addOnCompleteListener(this, task -> {
                if (task.isSuccessful()) {
                    checkUserRole(mAuth.getCurrentUser().getUid());
                } else {
                    Toast.makeText(LoginActivity.this, "Login Failed", Toast.LENGTH_SHORT).show();
                }
            });
    }

    private void checkUserRole(String uid) {
        db.collection("users").document(uid).get()
            .addOnSuccessListener(documentSnapshot -> {
                String role = documentSnapshot.getString("role");
                Intent intent = new Intent(LoginActivity.this, MainActivity.class);
                intent.putExtra("role", role);
                startActivity(intent);
                finish();
            });
    }
}
