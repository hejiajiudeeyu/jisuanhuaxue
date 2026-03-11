use std::ops::{Add, AddAssign, Mul, Sub};

#[derive(Clone, Copy, Debug, Default)]
pub struct Vec2 {
    pub x: f32,
    pub y: f32,
}

impl Vec2 {
    pub fn new(x: f32, y: f32) -> Self {
        Self { x, y }
    }

    pub fn length_sq(self) -> f32 {
        self.x * self.x + self.y * self.y
    }

    pub fn length(self) -> f32 {
        self.length_sq().sqrt()
    }

    pub fn normalized(self) -> Self {
        let len = self.length();
        if len < 1e-9 {
            Self::default()
        } else {
            Self {
                x: self.x / len,
                y: self.y / len,
            }
        }
    }

    pub fn clamp_length(self, min: f32, max: f32) -> Self {
        let len = self.length();
        if len < 1e-9 {
            return self;
        }
        let clamped = len.clamp(min, max);
        let scale = clamped / len;
        Self {
            x: self.x * scale,
            y: self.y * scale,
        }
    }

    pub fn distance_sq(self, other: Self) -> f32 {
        (self - other).length_sq()
    }

    pub fn distance(self, other: Self) -> f32 {
        self.distance_sq(other).sqrt()
    }

    pub fn wrap_pos(self, w: f32, h: f32) -> Self {
        Self {
            x: self.x.rem_euclid(w),
            y: self.y.rem_euclid(h),
        }
    }
}

pub fn wrap_delta(a: Vec2, b: Vec2, w: f32, h: f32) -> Vec2 {
    let mut dx = a.x - b.x;
    let mut dy = a.y - b.y;
    let hw = w * 0.5;
    let hh = h * 0.5;
    if dx > hw { dx -= w; }
    if dx < -hw { dx += w; }
    if dy > hh { dy -= h; }
    if dy < -hh { dy += h; }
    Vec2::new(dx, dy)
}

pub fn wrap_distance_sq(a: Vec2, b: Vec2, w: f32, h: f32) -> f32 {
    wrap_delta(a, b, w, h).length_sq()
}

impl Add for Vec2 {
    type Output = Self;
    fn add(self, rhs: Self) -> Self {
        Self {
            x: self.x + rhs.x,
            y: self.y + rhs.y,
        }
    }
}

impl AddAssign for Vec2 {
    fn add_assign(&mut self, rhs: Self) {
        self.x += rhs.x;
        self.y += rhs.y;
    }
}

impl Sub for Vec2 {
    type Output = Self;
    fn sub(self, rhs: Self) -> Self {
        Self {
            x: self.x - rhs.x,
            y: self.y - rhs.y,
        }
    }
}

impl Mul<f32> for Vec2 {
    type Output = Self;
    fn mul(self, rhs: f32) -> Self {
        Self {
            x: self.x * rhs,
            y: self.y * rhs,
        }
    }
}
