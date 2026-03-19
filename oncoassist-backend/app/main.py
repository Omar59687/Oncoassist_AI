# from fastapi import FastAPI, UploadFile, File
# from fastapi.middleware.cors import CORSMiddleware
# from typing import List
# import uvicorn

# app = FastAPI(title="OncoAssist AI API")

# # 1. إعداد CORS للسماح للفرونت-أند (Vite) بالاتصال
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"], # في الإنتاج نحدد بورت 5173 فقط
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# @app.post("/predict")
# async def predict(
#     mGE: UploadFile = File(...),
#     mDM: UploadFile = File(...),
#     mCNA: UploadFile = File(...)
# ):
#     # حالياً: نحن نستقبل الملفات ولكن لا نعالجها
#     # هذا هو الـ Mock Response الذي يحتاجه الفرونت-أند ليعرض الجمال الذي بنيناه
#     return {
#         "dataset": "BLCA",
#         "prediction": "High-TMB",
#         "confidence": 0.94,
#         "clinical_note": "High TMB suggests significant immunotherapy benefit (e.g., Pembrolizumab).",
#         "auc_roc": 0.99,
#         "fpr": [0.0, 0.05, 0.1, 0.2, 0.5, 1.0],
#         "tpr": [0.0, 0.72, 0.85, 0.92, 0.96, 1.0],
#         "top_genes": ["TP53", "BRCA1", "EGFR", "FGFR3"],
#         "top_drugs": [
#             {"name": "Pembrolizumab", "sensitivity": 0.84},
#             {"name": "Atezolizumab", "sensitivity": 0.79}
#         ]
#     }

# if __name__ == "__main__":
#     uvicorn.run(app, host="0.0.0.0", port=8000)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import predict

app = FastAPI(title="OncoAssist AI - Clean Backend")

# إعدادات CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ربط الـ Router
app.include_router(predict.router)


@app.get("/")
def home():
    return {"status": "OncoAssist Backend is Running Cleanly"}
