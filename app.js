let map;
let markers = [];

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} 로드 실패 (status ${res.status})`);
  return await res.json();
}

function ensureMap(lat, lng) {
  const container = document.getElementById("map");
  const center = new kakao.maps.LatLng(lat, lng);

  if (!map) {
    map = new kakao.maps.Map(container, {
      center,
      level: 4
    });
  } else {
    map.setCenter(center);
    map.setLevel(4);
  }
}

function clearMarkers() {
  markers.forEach(m => m.setMap(null));
  markers = [];
}

function approxDistanceMeters(aLat, aLng, bLat, bLng) {
  const dx = (aLat - bLat) * 111000;
  const dy = (aLng - bLng) * 88000;
  return Math.sqrt(dx * dx + dy * dy);
}

function addMarker(lat, lng, restaurant) {
  const marker = new kakao.maps.Marker({
    position: new kakao.maps.LatLng(lat, lng),
    title: restaurant.name
  });
  marker.setMap(map);
  markers.push(marker);

  const reservationText = restaurant.reservation === "phone" 
    ? "☎️ 전화예약" 
    : "🟢 네이버예약";
  
  const roomText = restaurant.hasRoom 
    ? "🚪 룸 있음" 
    : "🚪 룸 없음";

  const iw = new kakao.maps.InfoWindow({
    content: `
      <div style="padding:12px 14px; font-size:13px; line-height:1.6; min-width:200px;">
        <div style="font-weight:bold; font-size:14px; margin-bottom:8px;">${restaurant.name}</div>
        <div style="color:#333; margin-bottom:4px;">${reservationText}</div>
        <div style="color:#333; margin-bottom:4px;">${roomText}</div>
        <div style="color:#333;">💰 ${restaurant.priceRange}</div>
      </div>`
  });

  let isOpen = false;
  kakao.maps.event.addListener(marker, "click", () => {
    if (isOpen) {
      iw.close();
      isOpen = false;
    } else {
      iw.open(map, marker);
      isOpen = true;
    }
  });

  return marker;
}

async function runSearch() {
  const q = document.getElementById("q").value.trim();
  if (!q) return;

  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent = "로딩 중...";

  try {
    const places = await loadJSON("./data/places.json");
    const restaurants = await loadJSON("./data/restaurants.json");

    const place = places.find(p => p.name === q);
    if (!place) {
      alert(`places.json에 없는 지역입니다: ${q}`);
      if (statusEl) statusEl.textContent = "지역 없음";
      return;
    }

    ensureMap(place.lat, place.lng);

    const results = restaurants
      .map(r => ({
        ...r,
        _dist: approxDistanceMeters(place.lat, place.lng, r.lat, r.lng)
      }))
      .filter(r => r._dist <= (place.radiusMeters ?? 1200))
      .sort((a, b) => a._dist - b._dist);

    if (statusEl) statusEl.textContent = `${q} 결과 ${results.length}개`;

    // 목록 표시
    const list = document.getElementById("list");
    list.innerHTML = "";
    results.forEach(r => {
      const div = document.createElement("div");
      div.className = "item";
      
      const reservationTag = r.reservation === "phone" 
        ? '<span class="tag phone">☎️ 전화예약</span>'
        : '<span class="tag naver">🟢 네이버예약</span>';
      
      const roomTag = r.hasRoom
        ? '<span class="tag room-yes">🚪 룸 있음</span>'
        : '<span class="tag room-no">🚪 룸 없음</span>';
      
      div.innerHTML = `
        <div class="item-name">${r.name}</div>
        <div class="item-tags">
          ${reservationTag}
          ${roomTag}
          <span class="tag price">💰 ${r.priceRange}</span>
        </div>
        <div class="item-notes">${r.notes || ""}</div>
      `;
      
      div.onclick = () => {
        map.setCenter(new kakao.maps.LatLng(r.lat, r.lng));
        map.setLevel(3);
      };
      list.appendChild(div);
    });

    // 마커
    clearMarkers();
    results.forEach(r => addMarker(r.lat, r.lng, r));

  } catch (e) {
    console.error(e);
    if (statusEl) statusEl.textContent = "오류: " + e.message;
    alert("오류: " + e.message);
  }
}

document.getElementById("btnSearch").addEventListener("click", runSearch);
document.getElementById("q").addEventListener("keydown", (e) => {
  if (e.key === "Enter") runSearch();
});