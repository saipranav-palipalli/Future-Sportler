# **AI Archery Form Analyzer**

## **Overview**
The **AI Archery Form Analyzer** is a cutting-edge **web application** designed to **analyze** archery form through **video uploads**, providing detailed **biomechanical feedback**, **error detection**, and **actionable recommendations**. With a **premium**, **modern interface** and **advanced 3D visualization**, it empowers **archers** of all **skill levels** to improve their **technique** with **precise**, **quantified insights**.

This project combines a **robust backend** for **video analysis** with a **sleek frontend** featuring a **professional design**, **interactive 3D annotations**, and a **user-friendly workflow**. It supports **diverse archer profiles**, **camera angles**, and **lighting conditions**, ensuring **generalizability** and **accuracy**.

## **Features**
- **Premium Design**: A **clean**, **professional interface** with a **hero section**, **gradient text**, and **feature cards**.
- **Video Analysis**: Processes **videos** (e.g., **Video-1.mp4** to **Video-5.mp4**) to evaluate **stance**, **draw**, **anchor point**, and **release**.
- **3D Visualization**: **Interactive 3D canvas** with **Three.js**, showing:
  - **Color-coded skeleton** for **error detection**
  - **Error arrows** and **angle measurements** (e.g., "Elbow angle deviates by X degrees")
  - **Ideal vs. actual movement path overlays**
  - **Performance score** display
- **Skill Level Badges**: Displays **Beginner**, **Intermediate**, or **Advanced** for each **video**.
- **Quantified Feedback**: Provides **specific metrics** (e.g., **stance score**, **draw smoothness**) and **actionable recommendations**.
- **Generalizability**: Handles varied **archer body types**, **bow types** (**recurve/compound**), **camera angles**, and **lighting conditions**.

## **How It Works**
1. **Upload or Select Video**: Users can **upload** their own **videos** or select from **sample videos** (**Video-1.mp4** to **Video-5.mp4**).
2. **Analysis Processing**: The **backend** processes the **video** (17-25 seconds) using **AI** to analyze **biomechanical aspects**:
   - **Stance**: **Foot placement** and **body alignment** with **angle measurements**.
   - **Draw**: **Smoothness**, **elbow tracking**, and **shoulder consistency**.
   - **Anchor Point**: **Consistency** with **percentage variation**.
   - **Release**: **Hand movement detection**.
3. **Results Display**: The **frontend** presents:
   - A **3D visualization** with **error annotations**, Darrangle indicators**, and **color-coded skeleton**.
   - A **performance score** (e.g., 40/100 for **Video-1**) and **detailed metrics**.
   - **Actionable recommendations** for improvement.
4. **Interactive Controls**: Users can navigate **frames**, view **annotations**, and interact with the **3D scene**.

## **Technologies Used**
- **Frontend**:
  - **HTML**, **CSS** (**Tailwind CSS** for **styling**)
  - **JavaScript** (**Three.js** for **3D visualization**)
  - **React** (optional, for **dynamic components**)
- **Backend**:
  - **Python** (**Flask/FastAPI** for **API**)
  - **AI/ML models** for **biomechanical analysis**
  - **Video processing** libraries (e.g., **OpenCV**)
- **Testing**:
  - **Backend**: **Python** (**unittest** for **API testing**, as seen in `backend_test.py`)
  - **Frontend**: Manual testing for **UI/UX**, **modal**, and **3D rendering**
- **Deployment**:
  - Hosted on a **web server** (e.g., **Heroku**, **AWS**, or **Vercel**)
  - **CDN** for **static assets** (e.g., **Three.js**)

## **Installation**
1. **Clone** the **repository**:
   ```bash
   git clone https://github.com/your-username/ai-archery-form-analyzer.git

Install backend dependencies:
bashcd backend
pip install -r requirements.txt

Install frontend dependencies (if using React):
bashcd frontend
npm install

Run the backend server:
bashpython app.py

Run the frontend (if using React):
bashnpm start

Access the app at http://localhost:3000 (or your configured port).

Testing

Backend Tests: Run backend_test.py to test API endpoints and video analysis:
bashpython backend_test.py

Tests all 5 sample videos for generalizability, error detection, and performance.
Verifies API health, video processing, and error handling.


Frontend Tests: Manually verify:

Hero section with gradient text and feature cards.
Video modal with correct ordering and skill badges.
3D visualizations with error arrows, angle measurements, and interactive controls.



Sample Video Results

Video-1.mp4: Score 40/100, 4 errors, Intermediate
Video-2.mp4: Score 55/100, 3 errors, Beginner
Video-3.mp4: Score 25/100, 5 errors, Intermediate
Video-4.mp4: Score 40/100, 4 errors, Intermediate
Video-5.mp4: Score 40/100, 4 errors, Advanced

Future Improvements

Fix minor backend issue (invalid video returns 500 instead of 404).
Optimize WebGL performance to reduce console warnings.
Add support for real-time video analysis.
Expand to other sports with similar biomechanical analysis needs.

Contributing
Contributions are welcome! Please:

Fork the repository.
Create a feature branch (git checkout -b feature/YourFeature).
Commit changes (git commit -m 'Add YourFeature').
Push to the branch (git push origin feature/YourFeature).
Open a pull request.

License
This project is licensed under the MIT License. See the LICENSE file for details.
