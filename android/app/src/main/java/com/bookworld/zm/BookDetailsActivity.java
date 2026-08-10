package com.bookworld.zm;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import com.bumptech.glide.Glide;
import com.google.firebase.firestore.FirebaseFirestore;

public class BookDetailsActivity extends AppCompatActivity {

    private ImageView coverImage;
    private TextView titleText, authorText, priceText, descText;
    private Button actionBtn, saveOfflineBtn;
    private FirebaseFirestore db;
    private String pdfUrl, title;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_book_details);

        db = FirebaseFirestore.getInstance();
        String bookId = getIntent().getStringExtra("bookId");

        coverImage = findViewById(R.id.detailCover);
        titleText = findViewById(R.id.detailTitle);
        authorText = findViewById(R.id.detailAuthor);
        priceText = findViewById(R.id.detailPrice);
        descText = findViewById(R.id.detailDesc);
        actionBtn = findViewById(R.id.btn_buy_download);
        saveOfflineBtn = findViewById(R.id.btn_save_offline);

        if (bookId != null) {
            loadBookDetails(bookId);
        }
    }

    private void loadBookDetails(String id) {
        db.collection("books").document(id).get()
            .addOnSuccessListener(documentSnapshot -> {
                Book book = documentSnapshot.toObject(Book.class);
                if (book != null) {
                    title = book.getTitle();
                    titleText.setText(title);
                    authorText.setText("By " + book.getAuthor());
                    priceText.setText(book.getPrice() + " ZMW");
                    descText.setText(book.getDescription());
                    pdfUrl = book.getPdfUrl();

                    Glide.with(this).load(book.getCoverUrl()).into(coverImage);

                    actionBtn.setOnClickListener(v -> {
                        Toast.makeText(BookDetailsActivity.this, "Processing payment...", Toast.LENGTH_SHORT).show();
                        // Open PDF after "payment"
                        Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(pdfUrl));
                        startActivity(browserIntent);
                    });

                    saveOfflineBtn.setOnClickListener(v -> {
                        String fileName = title.replaceAll("\\s+", "_") + ".pdf";
                        Toast.makeText(this, "Starting download...", Toast.LENGTH_SHORT).show();
                        FileUtils.downloadBook(this, pdfUrl, fileName, new FileUtils.DownloadCallback() {
                            @Override
                            public void onDownloadComplete(java.io.File file) {
                                Toast.makeText(BookDetailsActivity.this, "Saved for offline reading!", Toast.LENGTH_LONG).show();
                                saveOfflineBtn.setText("Saved Offline");
                                saveOfflineBtn.setEnabled(false);
                            }

                            @Override
                            public void onDownloadFailed(Exception e) {
                                Toast.makeText(BookDetailsActivity.this, "Download failed: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                            }
                        });
                    });
                }
            });
    }
}
