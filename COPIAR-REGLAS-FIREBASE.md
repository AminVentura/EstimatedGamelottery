# Reglas de Firestore para Firebase Console

## Cómo aplicarlas

1. Entra en **Firebase Console**: https://console.firebase.google.com  
2. Selecciona tu proyecto (Game Lottery / game-lottery-b0e90).  
3. En el menú izquierdo: **Build** → **Firestore Database**.  
4. Abre la pestaña **Reglas** (Rules).  
5. **Borra todo** lo que haya en el editor y **pega exactamente** el bloque de abajo.  
6. Pulsa **Publicar** (Publish).

---

## Reglas para pegar (copiar todo desde rules_version hasta la última llave)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isSignedIn() {
      return request.auth != null;
    }

    function hasDrawingFields() {
      return request.resource.data.keys().hasAll(['mainNumbers', 'date'])
             && request.resource.data.date is string
             && (request.resource.data.mainNumbers is list || request.resource.data.mainNumbers is string);
    }
    function isValidDrawing() {
      return isSignedIn() && hasDrawingFields();
    }

    function isOwner() {
      return isSignedIn() && resource.data.userId == request.auth.uid;
    }

    match /artifacts/EstimatedGamelottery-app/public/data/powerball_drawings/{docId} {
      allow read: if true;
      allow create: if isValidDrawing();
      allow delete: if isOwner();
    }

    match /artifacts/EstimatedGamelottery-app/public/data/cash4life_drawings/{docId} {
      allow read: if true;
      allow create: if isValidDrawing();
      allow delete: if isOwner();
    }

    match /artifacts/EstimatedGamelottery-app/public/data/megamillions_drawings/{docId} {
      allow read: if true;
      allow create: if isValidDrawing();
      allow delete: if isOwner();
    }

    match /artifacts/EstimatedGamelottery-app/public/data/pick10_drawings/{docId} {
      allow read: if true;
      allow create: if isValidDrawing();
      allow delete: if isOwner();
    }
    match /artifacts/EstimatedGamelottery-app/public/data/take5day_drawings/{docId} {
      allow read: if true;
      allow create: if isValidDrawing();
      allow delete: if isOwner();
    }
    match /artifacts/EstimatedGamelottery-app/public/data/take5eve_drawings/{docId} {
      allow read: if true;
      allow create: if isValidDrawing();
      allow delete: if isOwner();
    }
    match /artifacts/EstimatedGamelottery-app/public/data/win4day_drawings/{docId} {
      allow read: if true;
      allow create: if isValidDrawing();
      allow delete: if isOwner();
    }
    match /artifacts/EstimatedGamelottery-app/public/data/win4eve_drawings/{docId} {
      allow read: if true;
      allow create: if isValidDrawing();
      allow delete: if isOwner();
    }

    match /artifacts/EstimatedGamelottery-app/public/data/lotto_comments/{docId} {
      allow read: if true;
      allow create: if isSignedIn() 
                    && request.resource.data.text is string
                    && request.resource.data.text.size() < 500;
    }

    match /artifacts/EstimatedGamelottery-app/public/data/user_stats/{userId} {
      allow read: if true;
      allow write: if isSignedIn() && request.auth.uid == userId;
    }
  }
}
```

---

Después de publicar, recarga tu página; los avisos de “Sin permiso para pick10 / take5day / win4day / take5eve / win4eve” deberían desaparecer.
