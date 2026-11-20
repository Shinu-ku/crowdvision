"""Venue zone polygon mapping, optional homography calibration, and real spatial heatmap generator."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import cv2
import numpy as np


def _ccw(p1: list[float] | tuple[float, float], p2: list[float] | tuple[float, float], p3: list[float] | tuple[float, float]) -> float:
    return (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0])


def _segments_intersect_strictly(
    p1: list[float] | tuple[float, float],
    p2: list[float] | tuple[float, float],
    p3: list[float] | tuple[float, float],
    p4: list[float] | tuple[float, float],
) -> bool:
    d1 = _ccw(p3, p4, p1)
    d2 = _ccw(p3, p4, p2)
    d3 = _ccw(p1, p2, p3)
    d4 = _ccw(p1, p2, p4)

    return bool(
        ((d1 > 1e-6 and d2 < -1e-6) or (d1 < -1e-6 and d2 > 1e-6))
        and ((d3 > 1e-6 and d4 < -1e-6) or (d3 < -1e-6 and d4 > 1e-6))
    )


def validate_polygon_geometry(points: list[list[float]]) -> tuple[bool, list[str]]:
    errors: list[str] = []
    if not points or len(points) < 3:
        errors.append("A polygon zone requires at least 3 distinct boundary vertices.")
        return False, errors

    n = len(points)
    for idx, pt in enumerate(points):
        if len(pt) < 2 or not np.isfinite(pt[0]) or not np.isfinite(pt[1]):
            errors.append(f"Vertex {idx} contains non-finite or invalid coordinates.")
            return False, errors

    for i in range(n):
        p_curr = points[i]
        p_next = points[(i + 1) % n]
        if np.hypot(p_next[0] - p_curr[0], p_next[1] - p_curr[1]) < 1e-5:
            errors.append(f"Vertices at index {i} and {(i + 1) % n} are coincident or too close.")
            return False, errors

    for i in range(n):
        p1 = points[i]
        p2 = points[(i + 1) % n]
        for j in range(i + 2, n):
            if (i == 0 and j == n - 1):
                continue
            p3 = points[j]
            p4 = points[(j + 1) % n]
            if _segments_intersect_strictly(p1, p2, p3, p4):
                errors.append(f"Polygon boundary self-intersects between edges ({i}-{(i+1)%n}) and ({j}-{(j+1)%n}).")
                return False, errors

    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += points[i][0] * points[j][1] - points[j][0] * points[i][1]
    area = 0.5 * abs(area)
    if area < 1e-5:
        errors.append("Degenerate polygon with near-zero area.")
        return False, errors

    return True, []


@dataclass
class ZoneDefinition:
    """In-memory zone geometry and capacity definition."""
    zone_id: str
    zone_name: str = ""
    zone_type: str = "GENERAL"
    polygon_points: list[list[float]] = field(default_factory=list)
    max_capacity: int = 50
    area_sqm: Optional[float] = None
    is_physically_calibrated: bool = False
    adjacent_zone_ids: Optional[list[str]] = None
    is_entry: bool = False
    is_exit: bool = False
    threshold_low: float = 0.45
    threshold_moderate: float = 0.65
    threshold_high: float = 0.82
    threshold_critical: float = 0.95
    density_moderate: Optional[float] = None
    density_high: Optional[float] = None
    density_critical: Optional[float] = None
    is_emergency_exit: bool = False
    color: str = "#0d9488"
    monitoring_priority: str = "ROUTINE"
    name: Optional[str] = None
    capacity: Optional[int] = None

    def __post_init__(self):
        if self.adjacent_zone_ids is None:
            self.adjacent_zone_ids = []
        if self.name and not self.zone_name:
            self.zone_name = self.name
        elif self.zone_name and not self.name:
            self.name = self.zone_name
        if self.capacity is not None:
            self.max_capacity = self.capacity
        else:
            self.capacity = self.max_capacity


class ZoneMapper:
    """Maps image-space coordinates to venue zones and constructs Gaussian density heatmaps."""

    def __init__(
        self,
        zones: list[ZoneDefinition],
        calibration_homography: Optional[list[list[float]] | np.ndarray] = None,
    ):
        self.zones = zones
        self._homography: Optional[np.ndarray] = None
        if calibration_homography is not None:
            self._homography = np.array(calibration_homography, dtype=np.float32)

        self._contours: dict[str, np.ndarray] = {}
        for z in zones:
            pts = np.array(z.polygon_points, dtype=np.float32)
            self._contours[z.zone_id] = pts

    @staticmethod
    def compute_homography(
        image_points: list[list[float]], venue_points: list[list[float]]
    ) -> list[list[float]]:
        if len(image_points) < 4 or len(venue_points) < 4:
            raise ValueError("At least 4 reference point pairs are required for homography calibration")

        src = np.array(image_points, dtype=np.float32)
        dst = np.array(venue_points, dtype=np.float32)
        matrix, _ = cv2.findHomography(src, dst, cv2.RANSAC)
        if matrix is None:
            raise ValueError("Could not compute valid homography matrix from supplied points")
        return matrix.tolist()

    def project_point(
        self, px: float, py: float, frame_w: int, frame_h: int
    ) -> tuple[float, float]:
        nx = max(0.0, min(1.0, float(px) / max(float(frame_w), 1.0)))
        ny = max(0.0, min(1.0, float(py) / max(float(frame_h), 1.0)))

        if self._homography is None:
            return nx, ny

        pt = np.array([[[float(px), float(py)]]], dtype=np.float32)
        projected = cv2.perspectiveTransform(pt, self._homography)
        mapped_x = float(projected[0, 0, 0])
        mapped_y = float(projected[0, 0, 1])
        return max(0.0, min(1.0, mapped_x)), max(0.0, min(1.0, mapped_y))

    def find_zone(self, norm_x: float, norm_y: float) -> Optional[ZoneDefinition]:
        for z in self.zones:
            contour = self._contours.get(z.zone_id)
            if contour is None:
                continue
            if cv2.pointPolygonTest(contour, (float(norm_x), float(norm_y)), False) >= 0:
                return z
        return None

    def generate_heatmap_grid(
        self,
        normalized_points: list[tuple[float, float]],
        grid_rows: int = 20,
        grid_cols: int = 12,
        sigma: float = 1.4,
    ) -> list[list[float]]:
        grid = np.zeros((grid_rows, grid_cols), dtype=np.float32)
        if not normalized_points:
            return grid.tolist()

        for nx, ny in normalized_points:
            c = min(grid_cols - 1, max(0, int(nx * grid_cols)))
            r = min(grid_rows - 1, max(0, int(ny * grid_rows)))
            grid[r, c] += 1.0

        if sigma > 0 and len(normalized_points) > 0:
            ksize = int(round(sigma * 3)) | 1
            if ksize < 3:
                ksize = 3
            grid = cv2.GaussianBlur(grid, (ksize, ksize), sigmaX=sigma, sigmaY=sigma)

        max_val = float(np.max(grid))
        if max_val > 1e-6:
            grid = grid / max_val

        return np.round(np.clip(grid, 0.0, 1.0), 3).tolist()

    def generate_predicted_heatmap_grid(
        self,
        base_grid: list[list[float]],
        predicted_growth_by_zone: Optional[dict[str, float]] = None,
        zone_velocity_by_zone: Optional[dict[str, tuple[float, float]]] = None,
        horizon_sec: int = 60,
        zone_scale_factors: Optional[dict[str, float]] = None,
        zone_velocities: Optional[dict[str, tuple[float, float]]] = None,
        **kwargs: Any,
    ) -> list[list[float]]:
        if not base_grid:
            return []

        rows = len(base_grid)
        cols = len(base_grid[0]) if rows > 0 else 0
        arr = np.array(base_grid, dtype=np.float32)
        if rows == 0 or cols == 0:
            return arr.tolist()

        growth_map = zone_scale_factors if zone_scale_factors is not None else (predicted_growth_by_zone or {})
        vel_map = zone_velocities if zone_velocities is not None else (zone_velocity_by_zone or {})

        time_norm = min(3.0, float(horizon_sec) / 60.0)

        # Scale by zone growth
        scaled = arr.copy()
        for z in self.zones:
            rate = growth_map.get(z.zone_id, 0.0)
            if rate > 0.5:
                mult = max(0.2, min(3.0, rate))
            else:
                mult = max(0.2, min(3.0, 1.0 + (rate * time_norm)))
            contour = self._contours.get(z.zone_id)
            if contour is None:
                continue
            for r in range(rows):
                for c in range(cols):
                    nx = (c + 0.5) / cols
                    ny = (r + 0.5) / rows
                    if cv2.pointPolygonTest(contour, (float(nx), float(ny)), False) >= 0:
                        scaled[r, c] *= mult

        # Advection
        advected = np.zeros_like(scaled)
        for r in range(rows):
            for c in range(cols):
                val = scaled[r, c]
                if val <= 0.001:
                    continue
                nx = (c + 0.5) / cols
                ny = (r + 0.5) / rows
                z = self.find_zone(nx, ny)
                vx, vy = vel_map.get(z.zone_id, (0.0, 0.0)) if z else (0.0, 0.0)
                target_c = c + int(round(vx * cols * time_norm * 0.4))
                target_r = r + int(round(vy * rows * time_norm * 0.4))
                tc = max(0, min(cols - 1, target_c))
                tr = max(0, min(rows - 1, target_r))
                advected[tr, tc] += val

        blended = 0.45 * scaled + 0.55 * advected
        ksize = 3 if horizon_sec <= 60 else 5
        sigma = 0.8 + 0.3 * (float(horizon_sec) / 60.0)
        smoothed = cv2.GaussianBlur(blended, (ksize, ksize), sigmaX=sigma, sigmaY=sigma)

        return np.round(np.clip(smoothed, 0.0, 1.0), 3).tolist()
