package com.bookworld.zm;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.Toast;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.storage.FirebaseStorage;
import com.google.firebase.storage.StorageReference;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class UploadActivity extends AppCompatActivity {

    private EditText titleEdit, authorEdit, priceEdit, descEdit;
    private ImageView coverImage;
    private Button selectCoverBtn, selectPdfBtn, uploadBtn;
    private ProgressBar progressBar;
    
    private Uri coverUri, pdfUri;
    private StorageReference storageRef;
    private FirebaseFirestore db;
    private FirebaseAuth mAuth;

    private static final int PICK_IMAGE_REQUEST = 1;
    private static final int PICK_PDF_REQUEST = 2;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_upload);

        storageRef = FirebaseStorage.getInstance().getReference();
        db = FirebaseFirestore.getInstance();
        mAuth = FirebaseAuth.getInstance();

        titleEdit = findViewById(R.id.up_title);
        authorEdit = findViewById(R.id.up_author);
        priceEdit = findViewById(R.id.up_price);
        descEdit = findViewById(R.id.up_desc);
        coverImage = findViewById(R.id.up_cover_preview);
        selectCoverBtn = findViewById(R.id.btn_select_cover);
        selectPdfBtn = findViewById(R.id.btn_select_pdf);
        uploadBtn = findViewById(R.id.btn_upload_book);
        progressBar = findViewById(R.id.upload_progress);

        selectCoverBtn.setOnClickListener(v -> openFileChooser(PICK_IMAGE_REQUEST));
        selectPdfBtn.setOnClickListener(v -> openFileChooser(PICK_PDF_REQUEST));
        uploadBtn.setOnClickListener(v -> uploadBook());
    }

    private void openFileChooser(int requestCode) {
        Intent intent = new Intent();
        if (requestCode == PICK_IMAGE_REQUEST) {
            intent.setType("image/*");
        } else {
            intent.setType("application/pdf");
        }
        intent.setAction(Intent.ACTION_GET_CONTENT);
        startActivityForResult(intent, requestCode);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode == RESULT_OK && data != null && data.getData() != null) {
            if (requestCode == PICK_IMAGE_REQUEST) {
                coverUri = data.getData();
                coverImage.setImageURI(coverUri);
            } else if (requestCode == PICK_PDF_REQUEST) {
                pdfUri = data.getData();
                Toast.makeText(this, "PDF Selected", Toast.LENGTH_SHORT).show();
            }
        }
    }

    private void uploadBook() {
        String title = titleEdit.getText().toString().trim();
        String author = authorEdit.getText().toString().trim();
        String price = priceEdit.getText().toString().trim();
        String desc = descEdit.getText().toString().trim();

        if (TextUtils.isEmpty(title) || TextUtils.isEmpty(author) || coverUri == null || pdfUri == null) {
            Toast.makeText(this, "Missing fields or files", Toast.LENGTH_SHORT).show();
            return;
        }

        progressBar.setVisibility(View.VISIBLE);
        uploadBtn.setEnabled(false);

        String bookId = UUID.randomUUID().toString();
        StorageReference coverPath = storageRef.child("covers/" + bookId + ".jpg");
        StorageReference pdfPath = storageRef.child("books/" + bookId + ".pdf");

        coverPath.putFile(coverUri).addOnSuccessListener(taskSnapshot -> {
            coverPath.getDownloadUrl().addOnSuccessListener(coverUrl -> {
                pdfPath.putFile(pdfUri).addOnSuccessListener(taskSnapshot2 -> {
                    pdfPath.getDownloadUrl().addOnSuccessListener(pdfUrl -> {
                        saveToFirestore(bookId, title, author, price, desc, coverUrl.toString(), pdfUrl.toString());
                    });
                });
            });
        }).addOnFailureListener(e -> {
            progressBar.setVisibility(View.GONE);
            uploadBtn.setEnabled(true);
            Toast.makeText(UploadActivity.this, "Upload failed", Toast.LENGTH_SHORT).show();
        });
    }

    private void saveToFirestore(String id, String title, String author, String price, String desc, String cover, String pdf) {
        Map<String, Object> book = new HashMap<>();
        book.put("title", title);
        book.put("author", author);
        book.put("price", price);
        book.put("description", desc);
        book.put("coverUrl", cover);
        book.put("pdfUrl", pdf);
        book.put("writerId", mAuth.getCurrentUser().getUid());

        db.collection("books").document(id).set(book)
            .addOnSuccessListener(aVoid -> {
                progressBar.setVisibility(View.GONE);
                Toast.makeText(UploadActivity.this, "Book Uploaded!", Toast.LENGTH_LONG).show();
                finish();
            });
    }
}
