package com.bookworld.zm;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.ArrayAdapter;
import android.widget.ListView;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class OfflineBooksActivity extends AppCompatActivity {

    private ListView listView;
    private List<File> bookFiles;
    private List<String> bookNames;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(android.R.layout.list_content); // Simple list layout

        listView = findViewById(android.R.id.list);
        bookFiles = new ArrayList<>();
        bookNames = new ArrayList<>();

        loadOfflineBooks();

        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, bookNames);
        listView.setAdapter(adapter);

        listView.setOnItemClickListener((parent, view, position, id) -> {
            File file = bookFiles.get(position);
            openPdf(file);
        });

        if (bookNames.isEmpty()) {
            Toast.makeText(this, "No offline books found.", Toast.LENGTH_LONG).show();
        }
    }

    private void loadOfflineBooks() {
        File directory = new File(getFilesDir(), "downloaded_books");
        if (directory.exists()) {
            File[] files = directory.listFiles();
            if (files != null) {
                for (File file : files) {
                    if (file.getName().endsWith(".pdf")) {
                        bookFiles.add(file);
                        bookNames.add(file.getName().replace("_", " ").replace(".pdf", ""));
                    }
                }
            }
        }
    }

    private void openPdf(File file) {
        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".provider", file);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/pdf");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(this, "No PDF viewer found on this device.", Toast.LENGTH_SHORT).show();
        }
    }
}
