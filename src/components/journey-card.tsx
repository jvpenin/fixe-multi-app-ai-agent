import Image from "next/image";
import { Icon } from "./ui-icon";
export function JourneyCard({
  city,
  arrival,
  step,
}: {
  city: string;
  arrival: string;
  step: number;
}) {
  return (
    <div className="journey-card">
      <div className="journey-photo">
        <Image
          src="/images/san-francisco-editorial.png"
          alt="A glimpse of a new neighborhood"
          fill
          sizes="300px"
        />
        <span>
          NEW PLACES.
          <br />
          MORE POSSIBILITIES.
        </span>
      </div>
      <div className="journey-details">
        <div className="eyebrow">
          YOUR ARRIVAL PASS <Icon name="plane" size={16} />
        </div>
        <span className="journey-destination">
          {city.split(",")[0] || "Your next chapter"}
        </span>
        <div className="journey-route">
          <i />
          <span />
          <Icon name="pin" size={18} />
        </div>
        <dl>
          <div>
            <dt>ARRIVAL</dt>
            <dd>
              {arrival && !Number.isNaN(Date.parse(arrival))
                ? new Date(arrival).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                : "Up to you"}
            </dd>
          </div>
          <div>
            <dt>THE PLAN</dt>
            <dd>First 72 hours</dd>
          </div>
        </dl>
        <div className="journey-barcode" />
        <div className="journey-foot">
          <span>LAND.AI</span>
          <span>STEP 0{step + 1} / 04</span>
        </div>
      </div>
    </div>
  );
}
